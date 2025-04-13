document.addEventListener('DOMContentLoaded', () => {
    const addLinkForm = document.getElementById('add-link-form');
    const urlInput = document.getElementById('url');
    const categoriesInput = document.getElementById('categories');
    const linksListDiv = document.getElementById('links-list');
    const totalLinksSpan = document.getElementById('total-links');
    const totalCategoriesSpan = document.getElementById('total-categories');
    const categoryFiltersDiv = document.getElementById('category-filters');
    const submitBtn = document.getElementById('submit-btn');
    const toastContainer = document.getElementById('toast-container');
    const parallaxContainer = document.getElementById('parallax-container');
    
    const apiUrl = 'http://127.0.0.1:5000/api/links'; // Default Flask dev server address

    let allLinks = []; // Store all links for filtering
    let activeCategory = 'All'; // Track the active category filter

    // Parallax background effect
    const handleParallax = (e) => {
        const orbs = document.querySelectorAll('.orb');
        
        // Calculate mouse position as a percentage of the screen
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        // Move orbs in the opposite direction to create parallax effect
        orbs.forEach((orb, index) => {
            const depth = (index + 1) * 20; // Different depths for each orb
            const moveX = (mouseX - 0.5) * depth;
            const moveY = (mouseY - 0.5) * depth;
            
            // Apply smooth transition
            orb.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    };

    // Add parallax effect on mouse move
    document.addEventListener('mousemove', handleParallax);

    // Toast notification function
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            </span>
            <span class="toast-message">${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove toast after animation completes
        setTimeout(() => {
            toast.remove();
        }, 5000);
    };
    
    // Button loading state
    const setButtonLoading = (isLoading) => {
        if (isLoading) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
        } else {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    };

    // Success state for button
    const setButtonSuccess = () => {
        submitBtn.classList.add('success');
        setTimeout(() => {
            submitBtn.classList.remove('success');
        }, 1500);
    };

    // Error state for input
    const setInputError = (input) => {
        input.classList.add('error');
        setTimeout(() => {
            input.classList.remove('error');
        }, 500);
    };

    // Function to render a single link as a card
    const renderLinkCard = (link, isNew = false) => {
        const card = document.createElement('div');
        card.className = 'link-card';
        if (isNew) card.classList.add('new');
        
        // Use default values if data is missing
        const faviconUrl = link.favicon_url || 'https://cdn-icons-png.flaticon.com/512/1150/1150626.png'; 
        const title = link.title || link.url.split('//')[1].split('/')[0];
        const categories = link.categories ? link.categories.split(',').map(cat => cat.trim()).filter(cat => cat) : [];
        
        card.innerHTML = `
            <div class="link-header">
                <img src="${faviconUrl}" alt="Favicon" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1150/1150626.png';">
                <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="link-title">${title}</a>
            </div>
            <div class="link-url">${link.url}</div>
            <div class="link-categories">
                ${categories.map(cat => `<span class="link-category">${cat}</span>`).join('')}
            </div>
        `;
        
        return card;
    };

    // Function to update stats display
    const updateStats = () => {
        // Update total links count with animation
        const oldLinkCount = parseInt(totalLinksSpan.textContent);
        const newLinkCount = allLinks.length;
        
        if (newLinkCount !== oldLinkCount) {
            totalLinksSpan.classList.add('highlight');
            totalLinksSpan.textContent = newLinkCount;
            setTimeout(() => totalLinksSpan.classList.remove('highlight'), 1000);
        }
        
        // Get unique categories and update count with animation
        const uniqueCategories = new Set();
        allLinks.forEach(link => {
            if (link.categories) {
                link.categories.split(',').forEach(cat => {
                    const trimmedCat = cat.trim();
                    if (trimmedCat) uniqueCategories.add(trimmedCat);
                });
            }
        });
        
        const oldCategoryCount = parseInt(totalCategoriesSpan.textContent);
        const newCategoryCount = uniqueCategories.size;
        
        if (newCategoryCount !== oldCategoryCount) {
            totalCategoriesSpan.classList.add('highlight');
            totalCategoriesSpan.textContent = newCategoryCount;
            setTimeout(() => totalCategoriesSpan.classList.remove('highlight'), 1000);
        }
        
        // Update category filters
        updateCategoryFilters(uniqueCategories);
    };

    // Function to update category filters
    const updateCategoryFilters = (uniqueCategories) => {
        // Clear existing filters except "All"
        categoryFiltersDiv.innerHTML = '<span class="tag active">All</span>';
        
        // Add a tag for each unique category
        uniqueCategories.forEach(category => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = category;
            tag.addEventListener('click', () => filterByCategory(category));
            categoryFiltersDiv.appendChild(tag);
        });
        
        // Add click handler to "All" tag
        categoryFiltersDiv.querySelector('.tag').addEventListener('click', () => filterByCategory('All'));
    };

    // Function to filter links by category
    const filterByCategory = (category) => {
        activeCategory = category;
        
        // Update active class on tags
        document.querySelectorAll('.tag').forEach(tag => {
            tag.classList.toggle('active', tag.textContent === category);
        });
        
        // Filter and display links
        displayLinks(
            category === 'All' 
                ? allLinks 
                : allLinks.filter(link => 
                    link.categories && link.categories.split(',').map(c => c.trim()).includes(category)
                )
        );

        // Show toast when filtering
        if (category !== 'All') {
            showToast(`Filtered by "${category}" category`, 'success');
        } else {
            showToast('Showing all links', 'success');
        }
    };

    // Function to fetch links and display them
    const fetchAndDisplayLinks = async () => {
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            allLinks = await response.json();
            
            // Update stats display
            updateStats();
            
            // Display all links (or filtered by active category)
            displayLinks(allLinks);

        } catch (error) {
            console.error('Error fetching links:', error);
            linksListDiv.innerHTML = '<p class="empty-state" style="color: #ff6b6b;">Error loading links. Please try again later.</p>';
            showToast('Failed to load links. Please try again later.', 'error');
        }
    };

    // Function to display links
    const displayLinks = (links) => {
        linksListDiv.innerHTML = ''; // Clear current list

        if (links.length === 0) {
            linksListDiv.innerHTML = '<p class="empty-state">No links found. Add your first link above!</p>';
            return;
        }

        // Render each link as a card
        links.forEach(link => {
            linksListDiv.appendChild(renderLinkCard(link));
        });
    };

    // Function to handle form submission
    const handleAddLink = async (event) => {
        event.preventDefault(); // Prevent default form submission

        const url = urlInput.value.trim();
        const categories = categoriesInput.value.trim();

        if (!url) {
            setInputError(urlInput);
            showToast('Please enter a valid URL', 'error');
            return;
        }

        try {
            // Show loading state
            setButtonLoading(true);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, categories })
            });

            if (!response.ok) {
                // Try to get error message from backend
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) { /* Ignore if response is not JSON */ }
                throw new Error(errorMsg);
            }

            // Get the newly created link data
            const newLink = await response.json();
            
            // Show success animation
            setButtonSuccess();
            showToast('Link added successfully!', 'success');

            // Clear the form
            urlInput.value = '';
            categoriesInput.value = '';

            // Add the new link to our list and update stats
            allLinks.unshift(newLink);
            updateStats();
            
            // If we're not filtering or the new link matches the filter, show it
            if (activeCategory === 'All' || 
                (newLink.categories && newLink.categories.split(',').map(c => c.trim()).includes(activeCategory))) {
                
                // If we're showing filtered results, refresh the display
                displayLinks(activeCategory === 'All' 
                    ? allLinks 
                    : allLinks.filter(link => 
                        link.categories && link.categories.split(',').map(c => c.trim()).includes(activeCategory)
                    )
                );
                
                // Highlight the new card
                setTimeout(() => {
                    const firstCard = linksListDiv.querySelector('.link-card');
                    if (firstCard) {
                        firstCard.classList.add('new');
                        // Scroll to the new card
                        firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }, 100);
            } else {
                // If the new link doesn't match the current filter, just update the stats
                showToast(`Link added but not shown (filtered by "${activeCategory}")`, 'success');
            }

        } catch (error) {
            console.error('Error adding link:', error);
            showToast(`Error adding link: ${error.message}`, 'error');
            setInputError(urlInput);
        } finally {
            setButtonLoading(false);
        }
    };

    // Add event listener to the form
    addLinkForm.addEventListener('submit', handleAddLink);

    // Style for the stats highlight
    const style = document.createElement('style');
    style.textContent = `
        @keyframes highlightAnimation {
            0% { transform: scale(1); color: var(--primary-color); }
            50% { transform: scale(1.2); color: #00E676; }
            100% { transform: scale(1); color: var(--primary-color); }
        }
        .highlight {
            animation: highlightAnimation 1s ease;
        }
    `;
    document.head.appendChild(style);

    // Initial fetch of links when the page loads
    fetchAndDisplayLinks();
}); 