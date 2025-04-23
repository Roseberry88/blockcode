// 공통 애니메이션 JavaScript 함수

// 페이지 로드 시 애니메이션 적용
document.addEventListener('DOMContentLoaded', function() {
    // 로딩 오버레이 사라지는 효과
    setTimeout(function() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.animation = 'fadeOut 0.5s ease forwards';
        }
    }, 1000);
    
    // 숫자 카운터 애니메이션
    animateCounters();
    
    // 프로그레스 바 애니메이션
    animateProgressBars();
    
    // 버튼 호버 효과 강화
    enhanceButtonEffects();
    
    // 카드 호버 효과 강화
    enhanceCardEffects();
    
    // 메뉴 항목 호버 효과 강화
    enhanceMenuEffects();
    
    // 프로필 아이콘 효과 강화
    enhanceProfileEffects();
});

// 숫자 카운터 애니메이션 함수
function animateCounters() {
    const counters = document.querySelectorAll('.counter');
    const speed = 200; // 애니메이션 속도 조절
    
    counters.forEach(counter => {
        const target = parseFloat(counter.getAttribute('data-target') || 0);
        if (!target) return;
        
        const isDecimal = target % 1 !== 0;
        const increment = target / speed;
        let count = 0;
        
        const updateCount = () => {
            if (count < target) {
                count += increment;
                if (count > target) count = target;
                
                if (isDecimal) {
                    counter.innerText = count.toFixed(1);
                } else {
                    counter.innerText = Math.round(count);
                }
                setTimeout(updateCount, 1);
            } else {
                counter.innerText = isDecimal ? target.toFixed(1) : target;
            }
        };
        
        updateCount();
    });
}

// 프로그레스 바 애니메이션 함수
function animateProgressBars() {
    const progressBars = document.querySelectorAll('.progress-bar-fill');
    progressBars.forEach(bar => {
        const targetWidth = bar.getAttribute('data-width') || bar.textContent;
        if (targetWidth) {
            setTimeout(() => {
                bar.style.width = targetWidth;
            }, 500);
        }
    });
}

// 버튼 호버 효과 강화 함수
function enhanceButtonEffects() {
    const buttons = document.querySelectorAll('.btn-hover, .action-button, .header-button, .control-button, .login-button, .signup-button, .nav-button, .start-button');
    buttons.forEach(button => {
        if (!button.hasAttribute('data-enhanced')) {
            button.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-3px)';
                this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
            });
            
            button.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
            
            button.setAttribute('data-enhanced', 'true');
        }
    });
}

// 카드 호버 효과 강화 함수
function enhanceCardEffects() {
    const cards = document.querySelectorAll('.card-hover, .card, .feature-box, .task-item');
    cards.forEach(card => {
        if (!card.hasAttribute('data-enhanced')) {
            card.addEventListener('mouseenter', function() {
                if (!this.classList.contains('active')) {
                    this.style.transform = 'translateY(-5px)';
                    this.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.1)';
                }
            });
            
            card.addEventListener('mouseleave', function() {
                if (!this.classList.contains('active')) {
                    this.style.transform = '';
                    this.style.boxShadow = '';
                }
            });
            
            card.setAttribute('data-enhanced', 'true');
        }
    });
}

// 메뉴 항목 호버 효과 강화 함수
function enhanceMenuEffects() {
    const menuItems = document.querySelectorAll('.tab-hover, .category-tab, .editor-tab, .menu-item, .algorithm-item');
    menuItems.forEach(item => {
        if (!item.hasAttribute('data-enhanced')) {
            item.addEventListener('mouseenter', function() {
                if (!this.classList.contains('active')) {
                    this.style.backgroundColor = '#e3f2fd';
                    this.style.transform = 'translateX(3px)';
                }
            });
            
            item.addEventListener('mouseleave', function() {
                if (!this.classList.contains('active')) {
                    this.style.backgroundColor = '';
                    this.style.transform = '';
                }
            });
            
            item.setAttribute('data-enhanced', 'true');
        }
    });
}

// 프로필 아이콘 효과 강화 함수
function enhanceProfileEffects() {
    const profiles = document.querySelectorAll('.profile-hover, .profile-icon, .profile-image, .avatar');
    profiles.forEach(profile => {
        if (!profile.hasAttribute('data-enhanced')) {
            profile.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.1)';
                this.style.boxShadow = '0 0 10px rgba(66, 133, 244, 0.3)';
            });
            
            profile.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
            
            profile.setAttribute('data-enhanced', 'true');
        }
    });
}

// 링크 버튼 효과 함수
function enhanceLinkButtons() {
    const linkButtons = document.querySelectorAll('.link-button');
    linkButtons.forEach(button => {
        if (!button.hasAttribute('data-enhanced')) {
            button.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.color = '#3b73d9';
            });
            
            button.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.color = '';
            });
            
            button.setAttribute('data-enhanced', 'true');
        }
    });
}

// 페이지 로드 시 강화 함수 호출
document.addEventListener('DOMContentLoaded', function() {
    enhanceLinkButtons();
});