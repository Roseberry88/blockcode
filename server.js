const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 간단한 인증 미들웨어
function checkAuth(req, res, next) {
    // 실제 프로덕션 환경에서는 세션/토큰 확인
    // 현재는 프론트엔드에서 sessionStorage로 처리하므로 여기서는 패스
    next();
}

// 교수 권한 체크 미들웨어
function checkTeacherAuth(req, res, next) {
    // 실제 프로덕션 환경에서는 세션/토큰에서 role 확인
    // 현재는 프론트엔드에서 sessionStorage로 처리하므로 여기서는 패스
    next();
}

// 메인 페이지 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S01_01.html'));
});

// 로그인 페이지 라우트
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S01_02.html'));
});

// 회원가입 페이지 라우트
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S01_03.html'));
});

// 비밀번호 찾기 페이지 라우트
app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S01_04.html'));
});

// 학생 대시보드 페이지 라우트
app.get('/dashboard', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S02.html'));
});

// 교수 대시보드 페이지 라우트
app.get('/teacher-dashboard', checkTeacherAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S02_2.html'));
});

// 블록 코딩 페이지 라우트
app.get('/block-coding', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S03.html'));
});

// 알고리즘 시각화 페이지 라우트
app.get('/algorithm', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S04.html'));
});

// 과제 관리 페이지 라우트
app.get('/assignments', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S05.html'));
});

// 학습 현황 페이지 라우트
app.get('/progress', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S06.html'));
});

// 교수용 과제 출제 페이지 라우트
app.get('/create-assignment', checkTeacherAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S07.html'));
});

// 교수용 제출물 평가 페이지 라우트
app.get('/review-submissions', checkTeacherAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S08.html'));
});

// 교수용 학생 성취도 페이지 라우트
app.get('/student-analytics', checkTeacherAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S09.html'));
});

// 로그인 API
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    // 간단한 사용자 인증 (실제로는 데이터베이스 확인)
    // 테스트용 계정
    const users = [
        { email: 'test@afa.ac.kr', password: 'password123', name: '김준호', role: '학생' },
        { email: 'teacher@afa.ac.kr', password: 'password123', name: '유승훈', role: '교수' }
    ];
    
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        res.json({ 
            success: true, 
            user: { 
                name: user.name, 
                email: user.email, 
                role: user.role 
            } 
        });
    } else {
        res.json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
});

// 회원가입 API
app.post('/api/signup', (req, res) => {
    // 실제로는 데이터베이스에 저장
    res.json({ success: true, message: '회원가입이 완료되었습니다.' });
});

// 비밀번호 찾기 API
app.post('/api/forgot-password', (req, res) => {
    // 실제로는 이메일 발송 로직
    res.json({ success: true, message: '임시 비밀번호가 이메일로 전송되었습니다.' });
});

// 사용자 진행률 API (샘플)
app.get('/api/user/progress', checkAuth, (req, res) => {
    // 실제로는 사용자 ID에 따라 데이터베이스에서 진행률을 조회해야 함
    res.json({
        success: true,
        progress: 30, // 백분율 (%)
        completedModules: 3,
        totalModules: 10
    });
});

app.get('/student-management', checkTeacherAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S10.html'));
});

// 교수용 학생 관리 페이지 라우트
app.get('/student-management', checkTeacherAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S10.html'));
});

// 서버 시작
app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다`);
});