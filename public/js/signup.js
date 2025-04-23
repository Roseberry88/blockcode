document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
    
    if (signupForm) {
      signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const name = document.getElementById('name').value;
        const studentId = document.getElementById('studentId').value;
        const password = document.getElementById('password').value;
        const role = document.querySelector('input[name="role"]:checked').value;
        
        fetch('/api/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, name, studentId, password, role })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert(data.message);
            // 로그인 페이지로 리디렉션
            window.location.href = '/login';
          } else {
            alert(data.message || '회원가입 실패. 다시 시도해주세요.');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          alert('회원가입 과정에서 오류가 발생했습니다.');
        });
      });
    }
  });