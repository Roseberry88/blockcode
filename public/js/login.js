document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // 세션 스토리지에 로그인 정보 저장
          sessionStorage.setItem('user', JSON.stringify(data.user));
          
          // 사용자 역할에 따라 다른 대시보드로 리디렉션
          if (data.user.role === '교수') {
            window.location.href = '/teacher-dashboard';
          } else {
            window.location.href = '/dashboard';
          }
        } else {
          alert(data.message || '로그인 실패. 다시 시도해주세요.');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('로그인 과정에서 오류가 발생했습니다.');
      });
    });
  }
});