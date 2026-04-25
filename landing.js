// landing.js — Premium Landing Page Interactions

document.addEventListener('DOMContentLoaded', () => {

  // ===== NAVBAR SCROLL EFFECT =====
  const navbar = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // ===== SCROLL REVEAL ANIMATIONS =====
  const animatedEls = document.querySelectorAll('.animate-on-scroll');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Stagger children in the same container
        const siblings = entry.target.parentElement.querySelectorAll('.animate-on-scroll');
        let delay = 0;
        siblings.forEach((sib, i) => {
          if (sib === entry.target) delay = i * 80;
        });
        
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  animatedEls.forEach(el => observer.observe(el));

  // ===== COUNTER ANIMATION =====
  const counterEls = document.querySelectorAll('.counter-value');
  
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-target'));
        animateCounter(el, 0, target, 1800);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  counterEls.forEach(el => counterObserver.observe(el));

  function animateCounter(el, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic for a smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * (end - start) + start);
      
      if (end >= 1000) {
        el.textContent = current.toLocaleString('en') + '+';
      } else {
        el.textContent = current + '%';
      }
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  // ===== AI CHAT TYPEWRITER EFFECT =====
  const aiResponse = document.querySelector('.ai-response');
  if (aiResponse) {
    const fullText = aiResponse.textContent;
    aiResponse.textContent = '';
    
    let charIndex = 0;
    const typingIndicator = aiResponse.parentElement.querySelector('.ai-typing');
    
    const typeObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Show typing dots first, then type the response
          setTimeout(() => {
            if (typingIndicator) typingIndicator.style.display = 'none';
            
            const typeInterval = setInterval(() => {
              if (charIndex < fullText.length) {
                aiResponse.textContent += fullText[charIndex];
                charIndex++;
              } else {
                clearInterval(typeInterval);
              }
            }, 25);
          }, 1500);
          
          typeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    
    typeObserver.observe(aiResponse.closest('.ai-demo'));
  }

  // ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

});
