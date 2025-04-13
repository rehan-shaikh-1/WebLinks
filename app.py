from flask import Flask, request, jsonify
import sqlite3
import logging # Optional: for logging errors
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re
from flask_cors import CORS  # Add CORS for frontend connection

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

DATABASE = 'linknest.db'

# Optional: Setup basic logging
logging.basicConfig(level=logging.INFO)

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row # Return rows as dict-like objects
    return conn

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            title TEXT,
            favicon_url TEXT,
            categories TEXT
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return "LinkNest Backend is running!"

def fetch_website_metadata(url):
    """Fetch the title and favicon URL from a given website URL"""
    # Default values in case we can't fetch them
    title = None
    favicon_url = None
    
    try:
        # Add scheme if missing
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        # Set a reasonable timeout
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()  # Raise exception for 4XX/5XX responses
        
        # Parse HTML content
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract title - first try <title> tag, then og:title meta tag
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.string.strip()
        
        if not title:
            og_title = soup.find('meta', property='og:title')
            if og_title:
                title = og_title.get('content', '').strip()
        
        # Extract favicon - try different common locations
        # 1. Look for rel="icon" or rel="shortcut icon"
        icon_link = soup.find('link', rel=re.compile(r'(shortcut )?icon', re.I))
        if icon_link and icon_link.get('href'):
            favicon_url = urljoin(url, icon_link.get('href'))
        
        # 2. If not found, try apple-touch-icon
        if not favicon_url:
            apple_icon = soup.find('link', rel=re.compile(r'apple-touch-icon', re.I))
            if apple_icon and apple_icon.get('href'):
                favicon_url = urljoin(url, apple_icon.get('href'))
        
        # 3. If still not found, try the default /favicon.ico path
        if not favicon_url:
            parsed_url = urlparse(url)
            favicon_url = f"{parsed_url.scheme}://{parsed_url.netloc}/favicon.ico"
        
        return {
            "title": title or "",
            "favicon_url": favicon_url or ""
        }
    
    except requests.RequestException as e:
        logging.error(f"Error fetching metadata for {url}: {e}")
        return {
            "title": "",
            "favicon_url": ""
        }

@app.route('/api/links', methods=['POST'])
def add_link():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    url = data.get('url')
    categories = data.get('categories') # Assuming categories is a comma-separated string for now

    if not url:
        return jsonify({"error": "URL is required"}), 400

    # For now, categories can be None or empty string
    if categories is None:
        categories = ""
    
    # Attempt to fetch metadata
    try:
        metadata = fetch_website_metadata(url)
        title = metadata["title"]
        favicon_url = metadata["favicon_url"]
        
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO links (url, title, favicon_url, categories) VALUES (?, ?, ?, ?)",
                (url, title, favicon_url, categories)
            )
            conn.commit()
            link_id = cursor.lastrowid
            logging.info(f"Added link: {url} with ID: {link_id}")
            
            # Return the newly created link with metadata
            return jsonify({
                "id": link_id, 
                "url": url, 
                "title": title, 
                "favicon_url": favicon_url, 
                "categories": categories
            }), 201
            
        except sqlite3.IntegrityError:
            # URL already exists due to UNIQUE constraint
            conn.rollback()
            logging.warning(f"Attempted to add duplicate URL: {url}")
            return jsonify({"error": "URL already exists"}), 409
        except Exception as e:
            conn.rollback()
            logging.error(f"Database error adding link {url}: {e}")
            return jsonify({"error": "Database error"}), 500
        finally:
            conn.close()
            
    except Exception as e:
        logging.error(f"Error processing link {url}: {e}")
        return jsonify({"error": f"Error processing link: {str(e)}"}), 500


@app.route('/api/links', methods=['GET'])
def get_links():
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, url, title, favicon_url, categories FROM links ORDER BY id DESC")
        links = [dict(row) for row in cursor.fetchall()]
        return jsonify(links)
    except Exception as e:
        logging.error(f"Database error getting links: {e}")
        return jsonify({"error": "Database error"}), 500
    finally:
        conn.close()


if __name__ == '__main__':
    init_db() # Initialize the database
    app.run(debug=True) 