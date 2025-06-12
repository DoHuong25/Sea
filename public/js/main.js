ocument.addEventListener('DOMContentLoaded', function () {
    // Carousel Logic
    const carousel = document.querySelector('#hero-carousel');
    if (carousel) {
        const slides = carousel.querySelectorAll('.carousel-slide');
        if (slides.length > 0) {
            let currentSlide = 0;
            const showSlide = (index) => {
                slides.forEach((slide, i) => {
                    slide.style.opacity = i === index ? '1' : '0';
                });
            };
            showSlide(0);
            setInterval(() => {
                currentSlide = (currentSlide + 1) % slides.length;
                showSlide(currentSlide);
            }, 3000);
        }
    }

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if(mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Star Rating Interaction
    const ratingInputContainer = document.querySelector('.rating-input');
    if(ratingInputContainer) {
        const stars = ratingInputContainer.querySelectorAll('.fa-star');
        const hiddenInput = ratingInputContainer.querySelector('input[name="stars"]');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const value = star.dataset.value;
                hiddenInput.value = value;
                stars.forEach(s => {
                    s.classList.toggle('fas', s.dataset.value <= value);
                    s.classList.toggle('far', s.dataset.value > value);
                });
            });
        });
    }
});