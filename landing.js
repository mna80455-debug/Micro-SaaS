// landing.js — Premium Landing Page Interactions
// Note: CONFIG is set globally via config.js

document.addEventListener('DOMContentLoaded', () => {

  // ===== FLOATING PARTICLES =====
  const heroSection = document.querySelector('.hero');
  if (heroSection) {
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.className = 'floating-particle';
      particle.style.cssText = `
        position: absolute;
        width: ${Math.random() * 6 + 2}px;
        height: ${Math.random() * 6 + 2}px;
        background: ${Math.random() > 0.5 ? 'var(--teal)' : '#8B5CF6'};
        border-radius: 50%;
        opacity: ${Math.random() * 0.4 + 0.1};
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: float${Math.floor(Math.random() * 3 + 3)}s ease-in-out infinite;
        animation-delay: ${Math.random() * 2}s;
      `;
      heroSection.appendChild(particle);
    }
  }

  // ===== 3D TILT EFFECT FOR CARDS =====
  document.querySelectorAll('.feature-card, .pricing-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
      card.style.transition = 'transform 0.1s ease';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
      card.style.transition = 'transform 0.4s ease';
    });
  });

  // ===== HOVER GLOW EFFECT =====
  document.querySelectorAll('.btn-primary-hero').forEach(btn => {
    btn.addEventListener('mouseenter', (e) => {
      const glow = document.createElement('div');
      glow.className = 'btn-glow-effect';
      glow.style.cssText = `
        position: absolute;
        width: 200px;
        height: 200px;
        background: radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%);
        transform: translate(-50%, -50%);
        pointer-events: none;
        animation: glowPulse 1s ease-out forwards;
      `;
      btn.appendChild(glow);
    });
  });

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

  // ===== PARALLAX EFFECT =====
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const hero = document.querySelector('.hero');
    if (hero && scrolled < 600) {
      const aurora = document.querySelector('.hero-aurora');
      if (aurora) {
        aurora.style.transform = `translateX(-50%) translateY(${scrolled * 0.3}px)`;
      }
    }
  });

  // ===== CURSOR TRAIL EFFECT =====
  const cursorTrail = [];
  let trailIndex = 0;
  
  document.addEventListener('mousemove', (e) => {
    cursorTrail[trailIndex] = { x: e.clientX, y: e.clientY, age: 0 };
    trailIndex = (trailIndex + 1) % 20;
    
    cursorTrail.forEach((point, i) => {
      if (point && point.age < 15) {
        point.age++;
      }
    });
  });

  // ===== SCROLL PROGRESS BAR =====
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--teal), #8B5CF6);
    width: 0%;
    z-index: 1000;
    transition: width 0.1s ease;
  `;
  document.body.appendChild(progressBar);
  
  window.addEventListener('scroll', () => {
    const winScroll = document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    progressBar.style.width = scrolled + '%';
  });

  // ===== STRIPE PAYMENT =====
  window.upgradeToPro = async function() {
    const user = JSON.parse(localStorage.getItem('bookflow_user'));
    if (!user) {
      window.location.href = 'app.html?redirect=upgrade';
      return;
    }

    const confirmMsg = 'سيتم توجيهك لصفحة الدفع Stripe لإتمام الاشتراك!\nالسعر: 99 ج.م/شهر';
    if (confirm(confirmMsg)) {
      window.location.href = 'app.html?upgrade=pro';
    }
  };

  window.upgradeToBusiness = function() {
    window.location.href = 'mailto:support@bookflow.app?subject=ترقية لـ Business';
  };

});
