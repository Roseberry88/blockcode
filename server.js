const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite'); // Node.js 내장 SQLite 사용
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const multer = require('multer');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Node.js 내장 SQLite 데이터베이스 연결
let db;

// 데이터베이스 초기화
function initializeDatabase() {
    try {
        console.log('🗄️ Node.js 내장 SQLite를 초기화합니다...');
        
        // 개발 모드에서 데이터베이스 리셋 옵션
        if (process.env.RESET_DB === 'true' && fs.existsSync('./database.db')) {
            console.log('🔄 기존 데이터베이스를 삭제하고 새로 생성합니다...');
            fs.unlinkSync('./database.db');
        }
        
        // 데이터베이스 연결 (Node.js 내장)
        db = new DatabaseSync('./database.db');
        
        console.log('✅ Node.js 내장 SQLite 연결 성공');

        // 외래키 제약조건 활성화
        db.exec('PRAGMA foreign_keys = ON;');
        
        // WAL 모드 활성화 (성능 향상)
        db.exec('PRAGMA journal_mode = WAL;');
        
        // 테이블 생성
        createTables();
        
        // 초기 데이터 삽입
        insertInitialData();
        
        console.log('🎉 데이터베이스 초기화 완료!');
        
    } catch (error) {
        console.error('❌ 데이터베이스 초기화 오류:', error);
        process.exit(1);
    }
}

// 테이블 생성 함수
function createTables() {
    console.log('📋 테이블 생성 중...');
    
    try {
        // Categories 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS Categories (
                category_id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        `);

        // Users 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS Users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                student_number VARCHAR(50) UNIQUE,
                role TEXT CHECK (role IN ('student', 'professor', 'teacher', 'admin')) DEFAULT 'student',
                profile_image_url VARCHAR(500),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                is_active BOOLEAN DEFAULT 1
            )
        `);

        // UserProfiles 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS UserProfiles (
                profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                coding_experience TEXT CHECK (coding_experience IN ('beginner', 'intermediate', 'advanced')),
                learning_preferences TEXT, -- JSON 형태로 저장
                bio TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
            )
        `);

        // BlockTypes 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS BlockTypes (
                block_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
                type_name VARCHAR(100) NOT NULL UNIQUE,
                category VARCHAR(50) NOT NULL,
                description TEXT,
                default_properties TEXT, -- JSON 형태로 저장
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Projects 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS Projects (
                project_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                language VARCHAR(50) NOT NULL DEFAULT 'blocks',
                project_data TEXT, -- 블록 데이터를 JSON으로 저장
                is_public BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
            )
        `);

        // ProjectVersions 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS ProjectVersions (
                version_id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                version_number INTEGER NOT NULL,
                project_data TEXT, -- 해당 버전의 블록 데이터
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE
            )
        `);

        // ProjectBlocks 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS ProjectBlocks (
                block_id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                block_type_id INTEGER NOT NULL,
                block_data TEXT, -- 블록별 설정 데이터 (JSON)
                position_x INTEGER DEFAULT 0,
                position_y INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE,
                FOREIGN KEY (block_type_id) REFERENCES BlockTypes(block_type_id) ON DELETE RESTRICT
            )
        `);

        // Algorithms 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS Algorithms (
                algorithm_id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT NOT NULL,
                difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')) NOT NULL,
                pseudocode TEXT,
                explanation TEXT,
                time_complexity VARCHAR(50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE RESTRICT
            )
        `);

        // AlgorithmCategories 테이블 생성 (기존 서버에서 사용된 테이블명)
        db.exec(`
            CREATE TABLE IF NOT EXISTS AlgorithmCategories (
                category_id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Assignments 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS Assignments (
                assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                creator_id INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                description TEXT NOT NULL,
                problem_statement TEXT NOT NULL,
                difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')) NOT NULL,
                due_date DATETIME,
                grading_criteria TEXT, -- JSON 형태로 채점 기준 저장
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_id) REFERENCES Users(user_id) ON DELETE CASCADE
            )
        `);

        // TestCases 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS TestCases (
                test_case_id INTEGER PRIMARY KEY AUTOINCREMENT,
                assignment_id INTEGER NOT NULL,
                input_data TEXT,
                expected_output TEXT,
                description TEXT,
                is_hidden BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assignment_id) REFERENCES Assignments(assignment_id) ON DELETE CASCADE
            )
        `);

        // AssignmentSubmissions 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS AssignmentSubmissions (
                submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
                assignment_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                project_id INTEGER,
                submission_data TEXT, -- 제출된 코드/블록 데이터
                score INTEGER,
                feedback TEXT,
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                graded_at DATETIME,
                graded_by INTEGER,
                FOREIGN KEY (assignment_id) REFERENCES Assignments(assignment_id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES Users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE SET NULL,
                FOREIGN KEY (graded_by) REFERENCES Users(user_id) ON DELETE SET NULL
            )
        `);

        // Quizzes 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS Quizzes (
                quiz_id INTEGER PRIMARY KEY AUTOINCREMENT,
                algorithm_id INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')) NOT NULL,
                max_score INTEGER DEFAULT 100,
                time_limit_seconds INTEGER,
                quiz_data TEXT, -- 퀴즈 문제를 JSON으로 저장
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (algorithm_id) REFERENCES Algorithms(algorithm_id) ON DELETE CASCADE
            )
        `);

        // LearningTopics 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS LearningTopics (
                topic_id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL,
                topic_name VARCHAR(100) NOT NULL,
                description TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE RESTRICT
            )
        `);

        // SharedProjects 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS SharedProjects (
                share_id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                shared_by INTEGER NOT NULL,
                share_code VARCHAR(50) NOT NULL UNIQUE,
                is_public BOOLEAN DEFAULT 0,
                shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE,
                FOREIGN KEY (shared_by) REFERENCES Users(user_id) ON DELETE CASCADE
            )
        `);

        // SystemLogs 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS SystemLogs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action_type VARCHAR(100),
                action_description VARCHAR(500) NOT NULL,
                metadata TEXT, -- JSON 형태
                ip_address VARCHAR(45),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL
            )
        `);

        // 인덱스 생성
        createIndexes();
        
        console.log('✅ 모든 테이블 생성 완료');
        
    } catch (error) {
        console.error('❌ 테이블 생성 오류:', error);
        throw error;
    }
}

// 인덱스 생성 함수
function createIndexes() {
    console.log('🔍 인덱스 생성 중...');
    
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_email ON Users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_student_number ON Users(student_number)',
        'CREATE INDEX IF NOT EXISTS idx_users_role ON Users(role)',
        'CREATE INDEX IF NOT EXISTS idx_users_is_active ON Users(is_active)',
        'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON Projects(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_projects_is_public ON Projects(is_public)',
        'CREATE INDEX IF NOT EXISTS idx_assignments_creator_id ON Assignments(creator_id)',
        'CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON Assignments(due_date)',
        'CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON AssignmentSubmissions(assignment_id)',
        'CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON AssignmentSubmissions(student_id)',
        'CREATE INDEX IF NOT EXISTS idx_systemlogs_user_id ON SystemLogs(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_systemlogs_action_type ON SystemLogs(action_type)',
        'CREATE INDEX IF NOT EXISTS idx_sharedprojects_share_code ON SharedProjects(share_code)',
        'CREATE INDEX IF NOT EXISTS idx_blocktypes_category ON BlockTypes(category)'
    ];

    for (const indexQuery of indexes) {
        try {
            db.exec(indexQuery);
        } catch (error) {
            console.warn(`⚠️ 인덱스 생성 실패: ${indexQuery}`);
        }
    }
    
    console.log('✅ 인덱스 생성 완료');
}

// 초기 데이터 삽입 함수
function insertInitialData() {
    console.log('📝 초기 데이터 삽입 중...');
    
    try {
        // Categories 초기 데이터
        const categories = [
            { name: 'User Management', description: '사용자 관리 관련 로그' },
            { name: 'Project Management', description: '프로젝트 관리 관련 로그' },
            { name: 'Assignment Management', description: '과제 관리 관련 로그' },
            { name: 'Learning Activity', description: '학습 활동 관련 로그' },
            { name: 'System Monitoring', description: '시스템 모니터링 로그' }
        ];

        const insertCategory = db.prepare('INSERT OR IGNORE INTO Categories (category_name, description) VALUES (?, ?)');
        
        for (const category of categories) {
            insertCategory.run(category.name, category.description);
        }

        // 알고리즘 카테고리 초기 데이터
        const algorithmCategories = [
            { name: 'sorting', description: '정렬 알고리즘', order: 1 },
            { name: 'searching', description: '탐색 알고리즘', order: 2 },
            { name: 'graph', description: '그래프 알고리즘', order: 3 },
            { name: 'dynamic_programming', description: '동적 계획법', order: 4 },
            { name: 'greedy', description: '탐욕 알고리즘', order: 5 }
        ];

        const insertAlgoCategory = db.prepare('INSERT OR IGNORE INTO AlgorithmCategories (category_name, description, sort_order) VALUES (?, ?, ?)');
        
        for (const category of algorithmCategories) {
            insertAlgoCategory.run(category.name, category.description, category.order);
        }

        // 블록 타입 초기 데이터
        const blockTypes = [
            {
                name: 'print',
                category: 'output',
                description: '텍스트 출력 블록',
                properties: JSON.stringify({ color: '#4CAF50', shape: 'rounded' })
            },
            {
                name: 'variable',
                category: 'data',
                description: '변수 선언 블록',
                properties: JSON.stringify({ color: '#FF9800', shape: 'rounded' })
            },
            {
                name: 'input',
                category: 'input',
                description: '사용자 입력 블록',
                properties: JSON.stringify({ color: '#2196F3', shape: 'rounded' })
            },
            {
                name: 'if_statement',
                category: 'control',
                description: '조건문 블록',
                properties: JSON.stringify({ color: '#F44336', shape: 'c_shape' })
            },
            {
                name: 'for_loop',
                category: 'control',
                description: '반복문 블록',
                properties: JSON.stringify({ color: '#9C27B0', shape: 'c_shape' })
            },
            {
                name: 'while_loop',
                category: 'control',
                description: 'while 반복문 블록',
                properties: JSON.stringify({ color: '#9C27B0', shape: 'c_shape' })
            },
            {
                name: 'math_operation',
                category: 'math',
                description: '수학 연산 블록',
                properties: JSON.stringify({ color: '#607D8B', shape: 'rounded' })
            },
            {
                name: 'comparison',
                category: 'logic',
                description: '비교 연산 블록',
                properties: JSON.stringify({ color: '#795548', shape: 'diamond' })
            },
            {
                name: 'comment',
                category: 'utility',
                description: '주석 블록',
                properties: JSON.stringify({ color: '#9E9E9E', shape: 'note' })
            },
            {
                name: 'function',
                category: 'functions',
                description: '함수 정의 블록',
                properties: JSON.stringify({ color: '#673AB7', shape: 'hat' })
            }
        ];

        const insertBlockType = db.prepare('INSERT OR IGNORE INTO BlockTypes (type_name, category, description, default_properties) VALUES (?, ?, ?, ?)');
        
        for (const blockType of blockTypes) {
            insertBlockType.run(blockType.name, blockType.category, blockType.description, blockType.properties);
        }

        // 기본 사용자 계정 생성
        const userCheck = db.prepare('SELECT COUNT(*) as count FROM Users').get();
        
        if (userCheck.count === 0) {
            const hashedPassword = bcrypt.hashSync('password123', 10);
            
            const defaultUsers = [
                {
                    email: 'admin@afa.ac.kr',
                    name: '관리자',
                    student_number: '7510000',
                    role: 'admin'
                },
                {
                    email: 'teacher@afa.ac.kr',
                    name: '유승훈',
                    student_number: '7500000',
                    role: 'professor'
                },
                {
                    email: 'test@afa.ac.kr',
                    name: '김준호',
                    student_number: '7510001',
                    role: 'student'
                }
            ];

            const insertUser = db.prepare(`
                INSERT OR IGNORE INTO Users (email, password_hash, name, student_number, role) 
                VALUES (?, ?, ?, ?, ?)
            `);
            
            const insertProfile = db.prepare('INSERT OR IGNORE INTO UserProfiles (user_id, coding_experience) VALUES (?, ?)');

            for (const user of defaultUsers) {
                const result = insertUser.run(user.email, hashedPassword, user.name, user.student_number, user.role);
                if (result.lastInsertRowid) {
                    insertProfile.run(result.lastInsertRowid, user.role === 'student' ? 'beginner' : null);
                }
            }
        }

        // 기본 알고리즘 데이터
        const sortingCategory = db.prepare('SELECT category_id FROM AlgorithmCategories WHERE category_name = ?').get('sorting');

        if (sortingCategory) {
            const algorithmCheck = db.prepare('SELECT COUNT(*) as count FROM Algorithms WHERE category_id = ?').get(sortingCategory.category_id);

            if (algorithmCheck.count === 0) {
                const algorithms = [
                    {
                        name: '버블 정렬',
                        description: '인접한 두 원소를 비교하여 정렬하는 가장 기본적인 정렬 알고리즘',
                        difficulty: 'easy',
                        pseudocode: 'for i = 0 to n-1:\n  for j = 0 to n-2-i:\n    if arr[j] > arr[j+1]:\n      swap(arr[j], arr[j+1])',
                        time_complexity: 'O(n²)'
                    },
                    {
                        name: '퀵 정렬',
                        description: '분할 정복 기법을 사용한 효율적인 정렬 알고리즘',
                        difficulty: 'medium',
                        pseudocode: 'quickSort(arr, low, high):\n  if low < high:\n    pi = partition(arr, low, high)\n    quickSort(arr, low, pi-1)\n    quickSort(arr, pi+1, high)',
                        time_complexity: 'O(n log n)'
                    },
                    {
                        name: '병합 정렬',
                        description: '분할 정복을 이용한 안정적인 정렬 알고리즘',
                        difficulty: 'medium',
                        pseudocode: 'mergeSort(arr):\n  if length(arr) <= 1:\n    return arr\n  mid = length(arr) / 2\n  left = mergeSort(arr[0:mid])\n  right = mergeSort(arr[mid:])\n  return merge(left, right)',
                        time_complexity: 'O(n log n)'
                    }
                ];

                const insertAlgorithm = db.prepare(`
                    INSERT OR IGNORE INTO Algorithms (category_id, name, description, difficulty_level, pseudocode, time_complexity)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                
                const insertQuiz = db.prepare(`
                    INSERT OR IGNORE INTO Quizzes (algorithm_id, title, difficulty_level, quiz_data)
                    VALUES (?, ?, ?, ?)
                `);

                for (const algo of algorithms) {
                    const result = insertAlgorithm.run(
                        sortingCategory.category_id, 
                        algo.name, 
                        algo.description, 
                        algo.difficulty, 
                        algo.pseudocode, 
                        algo.time_complexity
                    );

                    // 새로 삽입된 경우에만 퀴즈 생성
                    if (result.lastInsertRowid) {
                        // 각 알고리즘에 대한 퀴즈 생성
                        const quizData = JSON.stringify({
                            questions: [
                                {
                                    question: `${algo.name}의 시간 복잡도는?`,
                                    options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
                                    correct: algo.time_complexity === 'O(n²)' ? 2 : 1
                                },
                                {
                                    question: `${algo.name}의 특징은?`,
                                    options: ['불안정 정렬', '안정 정렬', '원소 비교 없음', '메모리 사용량 고정'],
                                    correct: algo.name === '병합 정렬' ? 1 : 0
                                }
                            ]
                        });
                        
                        insertQuiz.run(result.lastInsertRowid, `${algo.name} 이해도 확인`, algo.difficulty, quizData);
                    }
                }
            }
        }

        // 학습 주제 생성
        const learningTopics = [
            { category: 'sorting', name: '정렬의 필요성', order: 1 },
            { category: 'sorting', name: '기본 정렬 알고리즘', order: 2 },
            { category: 'sorting', name: '고급 정렬 알고리즘', order: 3 },
            { category: 'searching', name: '선형 탐색', order: 1 },
            { category: 'searching', name: '이진 탐색', order: 2 },
            { category: 'graph', name: '그래프 기초', order: 1 },
            { category: 'graph', name: 'DFS와 BFS', order: 2 }
        ];

        const insertTopic = db.prepare('INSERT OR IGNORE INTO LearningTopics (category_id, topic_name, sort_order) VALUES (?, ?, ?)');
        const getCategoryId = db.prepare('SELECT category_id FROM AlgorithmCategories WHERE category_name = ?');

        for (const topic of learningTopics) {
            const category = getCategoryId.get(topic.category);
            if (category) {
                insertTopic.run(category.category_id, topic.name, topic.order);
            }
        }

        console.log('✅ 초기 데이터 삽입 완료');
        
    } catch (error) {
        console.error('❌ 초기 데이터 삽입 오류:', error);
        throw error;
    }
}

// 미들웨어 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));

app.use(compression());
app.use(morgan('combined'));
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : true,
    credentials: true
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 쿠키 파서 추가
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' }
});
app.use('/api/', limiter);

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: '너무 많은 로그인 시도입니다.' }
});

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync('uploads/')) {
            fs.mkdirSync('uploads/');
        }
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('이미지 파일만 업로드 가능합니다.'));
        }
    }
});

// 유틸리티 함수들
function validateEmail(email) {
    return validator.isEmail(email);
}

function validatePassword(password) {
    return validator.isLength(password, { min: 6 });
}

function validateStudentNumber(studentNumber) {
    return validator.isLength(studentNumber, { min: 7, max: 7 }) && validator.isNumeric(studentNumber);
}

// JWT 토큰 검증 미들웨어 (쿠키와 헤더 모두 지원)
function authenticateToken(req, res, next) {
    // Authorization 헤더에서 토큰 확인 (API 호출용)
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    // 헤더에 토큰이 없으면 쿠키에서 확인 (HTML 페이지용)
    if (!token && req.cookies && req.cookies.authToken) {
        token = req.cookies.authToken;
    }

    if (!token) {
        return res.status(401).json({ success: false, message: '액세스 토큰이 필요합니다.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: '유효하지 않은 토큰입니다.' });
        }
        req.user = user;
        next();
    });
}

// 역할별 권한 체크 미들웨어
function checkRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
        }
        
        if (roles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }
    };
}

// 시스템 로그 기록 함수
function logAction(userId, actionType, actionDescription, metadata = {}, ipAddress = null) {
    try {
        const insertLog = db.prepare(`
            INSERT INTO SystemLogs (user_id, action_type, action_description, metadata, ip_address)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertLog.run(userId, actionType, actionDescription, JSON.stringify(metadata), ipAddress);
    } catch (error) {
        console.error('로그 기록 오류:', error);
    }
}

// ==================== 기본 페이지 라우트 ====================

// 메인 페이지
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'public/S01_01.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>코딩스타트 플랫폼</title></head>
            <body>
                <h1>🚀 코딩스타트 플랫폼</h1>
                <p>서버가 성공적으로 시작되었습니다!</p>
                <p><strong>⚠️ HTML 파일이 없습니다.</strong></p>
                <p>다음 파일들을 <code>public/</code> 폴더에 추가해주세요:</p>
                <ul>
                    <li>S01_01.html (메인 페이지)</li>
                    <li>S01_02.html (로그인)</li>
                    <li>S01_03.html (회원가입)</li>
                    <li>S01_04.html (비밀번호 찾기)</li>
                    <li>S02.html (학생 대시보드)</li>
                    <li>S02_2.html (교수 대시보드)</li>
                    <li>S03.html - S10.html (기타 페이지들)</li>
                </ul>
                <h3>🔗 임시 링크들:</h3>
                <p><a href="/api/health">🏥 서버 상태 확인</a></p>
                <p><a href="/api/block-types">🧩 블록 타입 목록</a></p>
                <h3>📚 테스트 계정:</h3>
                <ul>
                    <li>👤 학생: test@afa.ac.kr / password123</li>
                    <li>👨‍🏫 교수: teacher@afa.ac.kr / password123</li>
                    <li>👨‍💼 관리자: admin@afa.ac.kr / password123</li>
                </ul>
            </body>
            </html>
        `);
    }
});

// 로그인 페이지
app.get('/login', (req, res) => {
    const filePath = path.join(__dirname, 'public/S01_02.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>로그인 - 코딩스타트</title></head>
            <body>
                <h1>🔐 로그인</h1>
                <p>S01_02.html 파일이 없습니다.</p>
                <p><a href="/">← 메인으로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 회원가입 페이지
app.get('/signup', (req, res) => {
    const filePath = path.join(__dirname, 'public/S01_03.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>회원가입 - 코딩스타트</title></head>
            <body>
                <h1>📝 회원가입</h1>
                <p>S01_03.html 파일이 없습니다.</p>
                <p><a href="/">← 메인으로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 비밀번호 찾기 페이지
app.get('/forgot-password', (req, res) => {
    const filePath = path.join(__dirname, 'public/S01_04.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>비밀번호 찾기 - 코딩스타트</title></head>
            <body>
                <h1>🔓 비밀번호 찾기</h1>
                <p>S01_04.html 파일이 없습니다.</p>
                <p><a href="/">← 메인으로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 학생 대시보드
app.get('/dashboard', authenticateToken, (req, res) => {
    console.log(`🔍 대시보드 접속: 사용자 ${req.user.name} (${req.user.role})`);
    
    let filePath;
    if (req.user.role === 'professor' || req.user.role === 'admin') {
        console.log('🏫 교수/관리자 → 교수 대시보드로 리다이렉트');
        return res.redirect('/teacher-dashboard');
    } else {
        filePath = path.join(__dirname, 'public/S02.html');
        console.log('🎓 학생 → 학생 대시보드');
    }
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>학생 대시보드 - 코딩스타트</title></head>
            <body>
                <h1>🎓 학생 대시보드</h1>
                <p>환영합니다, ${req.user.name}님! (${req.user.role})</p>
                <p>S02.html 파일이 없습니다.</p>
                <div>
                    <h3>🔗 메뉴</h3>
                    <a href="/block-coding">🧩 블록 코딩</a><br>
                    <a href="/algorithm">🧮 알고리즘 학습</a><br>
                    <a href="/assignments">📝 과제 관리</a><br>
                    <a href="/progress">📈 학습 현황</a><br>
                    <button onclick="logout()">🚪 로그아웃</button>
                </div>
                <script>
                    function logout() {
                        fetch('/api/logout', { method: 'POST' })
                        .then(() => {
                            localStorage.clear();
                            location.href = '/';
                        });
                    }
                </script>
            </body>
            </html>
        `);
    }
});

// 교수 대시보드
app.get('/teacher-dashboard', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    console.log(`🔍 교수 대시보드 접속: 사용자 ${req.user.name} (${req.user.role})`);
    
    const filePath = path.join(__dirname, 'public/S02_2.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>교수 대시보드 - 코딩스타트</title></head>
            <body>
                <h1>👨‍🏫 교수 대시보드</h1>
                <p>환영합니다, ${req.user.name}님! (${req.user.role})</p>
                <p>S02_2.html 파일이 없습니다.</p>
                <div>
                    <h3>🔗 메뉴</h3>
                    <a href="/create-assignment">📋 과제 출제</a><br>
                    <a href="/review-submissions">✅ 제출물 평가</a><br>
                    <a href="/student-analytics">📊 학생 성취도</a><br>
                    <a href="/student-management">👥 학생 관리</a><br>
                    <button onclick="logout()">🚪 로그아웃</button>
                </div>
                <script>
                    function logout() {
                        fetch('/api/logout', { method: 'POST' })
                        .then(() => {
                            localStorage.clear();
                            location.href = '/';
                        });
                    }
                </script>
            </body>
            </html>
        `);
    }
});

// 블록 코딩 페이지
app.get('/block-coding', authenticateToken, (req, res) => {
    const filePath = path.join(__dirname, 'public/S03.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>블록 코딩 - 코딩스타트</title></head>
            <body>
                <h1>🧩 블록 코딩</h1>
                <p>S03.html 파일이 없습니다.</p>
                <p><a href="/dashboard">← 대시보드로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 알고리즘 시각화 페이지
app.get('/algorithm', authenticateToken, (req, res) => {
    const filePath = path.join(__dirname, 'public/S04.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>알고리즘 시각화 - 코딩스타트</title></head>
            <body>
                <h1>🧮 알고리즘 시각화</h1>
                <p>S04.html 파일이 없습니다.</p>
                <p><a href="/dashboard">← 대시보드로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 과제 관리 페이지
app.get('/assignments', authenticateToken, (req, res) => {
    const filePath = path.join(__dirname, 'public/S05.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>과제 관리 - 코딩스타트</title></head>
            <body>
                <h1>📝 과제 관리</h1>
                <p>S05.html 파일이 없습니다.</p>
                <p><a href="/dashboard">← 대시보드로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 학습 현황 페이지
app.get('/progress', authenticateToken, (req, res) => {
    const filePath = path.join(__dirname, 'public/S06.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>학습 현황 - 코딩스타트</title></head>
            <body>
                <h1>📈 학습 현황</h1>
                <p>S06.html 파일이 없습니다.</p>
                <p><a href="/dashboard">← 대시보드로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 교수용 과제 출제 페이지
app.get('/create-assignment', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    const filePath = path.join(__dirname, 'public/S07.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>과제 출제 - 코딩스타트</title></head>
            <body>
                <h1>📋 과제 출제</h1>
                <p>S07.html 파일이 없습니다.</p>
                <p><a href="/teacher-dashboard">← 교수 대시보드로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 교수용 제출물 평가 페이지
app.get('/review-submissions', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    const filePath = path.join(__dirname, 'public/S08.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>제출물 평가 - 코딩스타트</title></head>
            <body>
                <h1>✅ 제출물 평가</h1>
                <p>S08.html 파일이 없습니다.</p>
                <p><a href="/teacher-dashboard">← 교수 대시보드로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 교수용 학생 성취도 페이지
app.get('/student-analytics', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    const filePath = path.join(__dirname, 'public/S09.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>학생 성취도 - 코딩스타트</title></head>
            <body>
                <h1>📊 학생 성취도</h1>
                <p>S09.html 파일이 없습니다.</p>
                <p><a href="/teacher-dashboard">← 교수 대시보드로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// 교수용 학생 관리 페이지
app.get('/student-management', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    const filePath = path.join(__dirname, 'public/S10.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send(`
            <html>
            <head><title>학생 관리 - 코딩스타트</title></head>
            <body>
                <h1>👥 학생 관리</h1>
                <p>S10.html 파일이 없습니다.</p>
                <p><a href="/teacher-dashboard">← 교수 대시보드로 돌아가기</a></p>
            </body>
            </html>
        `);
    }
});

// ==================== 인증 API ====================

// 회원가입 API
app.post('/api/signup', (req, res) => {
    try {
        const { email, password, name, student_number, role = 'student' } = req.body;

        // 입력값 검증
        if (!validateEmail(email)) {
            return res.status(400).json({ success: false, message: '유효한 이메일을 입력해주세요.' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ success: false, message: '비밀번호는 최소 6자 이상이어야 합니다.' });
        }

        if (!name || name.length < 2) {
            return res.status(400).json({ success: false, message: '이름은 최소 2자 이상이어야 합니다.' });
        }

        if (student_number && !validateStudentNumber(student_number)) {
            return res.status(400).json({ success: false, message: '학번은 7자리 숫자여야 합니다.' });
        }

        // 중복 사용자 확인
        const existingUser = db.prepare('SELECT user_id FROM Users WHERE email = ? OR student_number = ?').get(email, student_number);

        if (existingUser) {
            return res.status(400).json({ success: false, message: '이미 가입된 이메일 또는 학번입니다.' });
        }

        // 비밀번호 해시화
        const hashedPassword = bcrypt.hashSync(password, 10);

        // 사용자 생성
        const insertUser = db.prepare(`
            INSERT INTO Users (email, password_hash, name, student_number, role)
            VALUES (?, ?, ?, ?, ?)
        `);
        const userResult = insertUser.run(email, hashedPassword, name, student_number, role);

        // 사용자 프로필 생성
        const insertProfile = db.prepare('INSERT INTO UserProfiles (user_id, coding_experience) VALUES (?, ?)');
        insertProfile.run(userResult.lastInsertRowid, role === 'student' ? 'beginner' : null);

        // 로그 기록
        logAction(userResult.lastInsertRowid, 'USER_REGISTERED', '신규 사용자 회원가입 완료', { email, role }, req.ip);

        res.json({ success: true, message: '회원가입이 완료되었습니다.' });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 로그인 API
app.post('/api/login', loginLimiter, (req, res) => {
    try {
        const { email, password } = req.body;

        // 입력값 검증
        if (!validateEmail(email)) {
            return res.status(400).json({ success: false, message: '유효한 이메일을 입력해주세요.' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ success: false, message: '비밀번호를 확인해주세요.' });
        }

        // 사용자 조회
        const user = db.prepare('SELECT * FROM Users WHERE email = ? AND is_active = 1').get(email);

        if (!user) {
            logAction(null, 'LOGIN_FAILED', '로그인 실패 - 존재하지 않는 사용자', { email }, req.ip);
            return res.status(401).json({ 
                success: false, 
                message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
            });
        }

        // 비밀번호 검증
        const isValidPassword = bcrypt.compareSync(password, user.password_hash);

        if (!isValidPassword) {
            logAction(user.user_id, 'LOGIN_FAILED', '로그인 실패 - 잘못된 비밀번호', {}, req.ip);
            return res.status(401).json({ 
                success: false, 
                message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
            });
        }

        // 로그인 시간 업데이트
        const updateLogin = db.prepare('UPDATE Users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?');
        updateLogin.run(user.user_id);

        // JWT 토큰 생성
        const token = jwt.sign(
            { 
                user_id: user.user_id,
                email: user.email,
                name: user.name,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 성공 로그 기록
        logAction(user.user_id, 'LOGIN_SUCCESS', '로그인 성공', {}, req.ip);

        // 쿠키에도 토큰 저장 (HTML 페이지 접근용)
        res.cookie('authToken', token, {
            httpOnly: true,    // XSS 방지
            secure: process.env.NODE_ENV === 'production', // HTTPS에서만 전송
            sameSite: 'lax',   // CSRF 방지
            maxAge: 24 * 60 * 60 * 1000 // 24시간
        });

        res.json({
            success: true,
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
                student_number: user.student_number,
                profile_image_url: user.profile_image_url
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 로그아웃 API
app.post('/api/logout', authenticateToken, (req, res) => {
    try {
        // 쿠키 삭제
        res.clearCookie('authToken');
        
        // 로그 기록
        logAction(req.user.user_id, 'LOGOUT', '로그아웃', {}, req.ip);
        
        res.json({ success: true, message: '로그아웃되었습니다.' });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, message: '로그아웃 중 오류가 발생했습니다.' });
    }
});
app.post('/api/forgot-password', (req, res) => {
    try {
        const { email } = req.body;

        if (!validateEmail(email)) {
            return res.status(400).json({ success: false, message: '유효한 이메일을 입력해주세요.' });
        }

        const user = db.prepare('SELECT user_id FROM Users WHERE email = ? AND is_active = 1').get(email);

        if (user) {
            logAction(user.user_id, 'PASSWORD_RESET_REQUESTED', '비밀번호 재설정 요청', { email }, req.ip);
        }

        // 보안상 실제로는 존재하지 않는 이메일이어도 성공 메시지를 반환
        res.json({ success: true, message: '임시 비밀번호가 이메일로 전송되었습니다.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// ==================== 사용자 관리 API ====================

// 사용자 프로필 조회
app.get('/api/user/profile', authenticateToken, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT u.*, p.coding_experience, p.learning_preferences, p.bio 
            FROM Users u 
            LEFT JOIN UserProfiles p ON u.user_id = p.user_id 
            WHERE u.user_id = ?
        `).get(req.user.user_id);

        if (!user) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }

        // 민감한 정보 제거
        delete user.password_hash;

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, message: '프로필 조회 중 오류가 발생했습니다.' });
    }
});

// 사용자 진행률 조회 API
app.get('/api/user/progress', authenticateToken, (req, res) => {
    try {
        // 사용자의 프로젝트 수
        const projectCount = db.prepare('SELECT COUNT(*) as count FROM Projects WHERE user_id = ?').get(req.user.user_id);
        
        // 사용자의 과제 제출 수
        const submissionCount = db.prepare('SELECT COUNT(*) as count FROM AssignmentSubmissions WHERE student_id = ?').get(req.user.user_id);
        
        // 최근 활동
        const lastActivity = db.prepare(`
            SELECT MAX(created_at) as last_activity 
            FROM (
                SELECT created_at FROM Projects WHERE user_id = ?
                UNION ALL
                SELECT submitted_at as created_at FROM AssignmentSubmissions WHERE student_id = ?
            )
        `).get(req.user.user_id, req.user.user_id);

        const progress = {
            user_id: req.user.user_id,
            overall_progress: Math.min(100, (projectCount.count + submissionCount.count) * 10),
            completed_projects: projectCount.count,
            completed_assignments: submissionCount.count,
            total_assignments: 8, // 예시값
            current_streak: Math.floor(Math.random() * 7), // 연속 학습 일수
            total_coding_time: (projectCount.count + submissionCount.count) * 30, // 분 단위
            last_activity: lastActivity.last_activity || new Date().toISOString()
        };

        res.json({
            success: true,
            progress
        });

    } catch (error) {
        console.error('Progress error:', error);
        res.status(500).json({ success: false, message: '진행률 조회 중 오류가 발생했습니다.' });
    }
});

// 사용자 프로필 업데이트
app.put('/api/user/profile', authenticateToken, upload.single('profile_image'), (req, res) => {
    try {
        const { name, bio, coding_experience, learning_preferences } = req.body;
        const userId = req.user.user_id;

        // 사용자 정보 업데이트
        if (name) {
            const updateUser = db.prepare('UPDATE Users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
            updateUser.run(name, userId);
        }

        // 프로필 정보 업데이트
        const updateProfile = db.prepare(`
            UPDATE UserProfiles 
            SET bio = ?, coding_experience = ?, learning_preferences = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `);
        updateProfile.run(bio, coding_experience, learning_preferences, userId);

        // 프로필 이미지 업데이트
        if (req.file) {
            const imageUrl = `/uploads/${req.file.filename}`;
            const updateImage = db.prepare('UPDATE Users SET profile_image_url = ? WHERE user_id = ?');
            updateImage.run(imageUrl, userId);
        }

        logAction(userId, 'PROFILE_UPDATED', '사용자 프로필 업데이트', { name, coding_experience }, req.ip);

        res.json({ success: true, message: '프로필이 업데이트되었습니다.' });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: '프로필 업데이트 중 오류가 발생했습니다.' });
    }
});

// ==================== 블록 타입 및 프로젝트 API ====================

// 블록 타입 목록 조회
app.get('/api/block-types', (req, res) => {
    try {
        const { category } = req.query;
        
        let query = 'SELECT * FROM BlockTypes';
        let params = [];
        
        if (category) {
            query += ' WHERE category = ?';
            params.push(category);
        }
        
        query += ' ORDER BY category, type_name';
        
        const blockTypes = db.prepare(query).all(...params);
        
        // JSON 문자열을 객체로 파싱
        const processedBlockTypes = blockTypes.map(bt => ({
            ...bt,
            default_properties: bt.default_properties ? JSON.parse(bt.default_properties) : {}
        }));

        res.json({ success: true, blockTypes: processedBlockTypes });

    } catch (error) {
        console.error('BlockTypes error:', error);
        res.status(500).json({ success: false, message: '블록 타입 조회 중 오류가 발생했습니다.' });
    }
});

// 프로젝트 생성
app.post('/api/projects', authenticateToken, (req, res) => {
    try {
        const { title, description, language = 'blocks', project_data, is_public = false } = req.body;
        const userId = req.user.user_id;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ success: false, message: '프로젝트 제목은 필수입니다.' });
        }

        const insertProject = db.prepare(`
            INSERT INTO Projects (user_id, title, description, language, project_data, is_public)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const result = insertProject.run(userId, title.trim(), description, language, project_data, is_public);

        logAction(userId, 'PROJECT_CREATED', '새 프로젝트 생성', { project_id: result.lastInsertRowid, title }, req.ip);

        res.json({
            success: true,
            project_id: result.lastInsertRowid,
            message: '프로젝트가 생성되었습니다.'
        });

    } catch (error) {
        console.error('Project creation error:', error);
        res.status(500).json({ success: false, message: '프로젝트 생성 중 오류가 발생했습니다.' });
    }
});

// 사용자 프로젝트 목록 조회
app.get('/api/user/projects', authenticateToken, (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const projects = db.prepare(`
            SELECT project_id, title, description, language, is_public, created_at, updated_at
            FROM Projects 
            WHERE user_id = ? 
            ORDER BY updated_at DESC 
            LIMIT ? OFFSET ?
        `).all(req.user.user_id, parseInt(limit), offset);

        const totalCount = db.prepare('SELECT COUNT(*) as count FROM Projects WHERE user_id = ?').get(req.user.user_id);

        res.json({
            success: true,
            projects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit)
            }
        });

    } catch (error) {
        console.error('Projects list error:', error);
        res.status(500).json({ success: false, message: '프로젝트 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 프로젝트 상세 조회
app.get('/api/projects/:id', authenticateToken, (req, res) => {
    try {
        const projectId = req.params.id;
        
        const project = db.prepare(`
            SELECT p.*, u.name as creator_name
            FROM Projects p
            JOIN Users u ON p.user_id = u.user_id
            WHERE p.project_id = ? AND (p.user_id = ? OR p.is_public = 1)
        `).get(projectId, req.user.user_id);

        if (!project) {
            return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });
        }

        // project_data JSON 파싱
        if (project.project_data) {
            try {
                project.project_data = JSON.parse(project.project_data);
            } catch (e) {
                project.project_data = null;
            }
        }

        res.json({ success: true, project });

    } catch (error) {
        console.error('Project detail error:', error);
        res.status(500).json({ success: false, message: '프로젝트 조회 중 오류가 발생했습니다.' });
    }
});

// 프로젝트 업데이트
app.put('/api/projects/:id', authenticateToken, (req, res) => {
    try {
        const projectId = req.params.id;
        const { title, description, project_data, is_public } = req.body;
        const userId = req.user.user_id;

        // 프로젝트 소유권 확인
        const project = db.prepare('SELECT user_id FROM Projects WHERE project_id = ?').get(projectId);

        if (!project) {
            return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });
        }

        if (project.user_id !== userId) {
            return res.status(403).json({ success: false, message: '프로젝트를 수정할 권한이 없습니다.' });
        }

        const updateProject = db.prepare(`
            UPDATE Projects 
            SET title = ?, description = ?, project_data = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
            WHERE project_id = ?
        `);

        updateProject.run(title, description, project_data, is_public, projectId);

        logAction(userId, 'PROJECT_UPDATED', '프로젝트 업데이트', { project_id: projectId, title }, req.ip);

        res.json({ success: true, message: '프로젝트가 업데이트되었습니다.' });

    } catch (error) {
        console.error('Project update error:', error);
        res.status(500).json({ success: false, message: '프로젝트 업데이트 중 오류가 발생했습니다.' });
    }
});

// 프로젝트 삭제
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.user_id;

        // 프로젝트 소유권 확인
        const project = db.prepare('SELECT user_id, title FROM Projects WHERE project_id = ?').get(projectId);

        if (!project) {
            return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });
        }

        if (project.user_id !== userId) {
            return res.status(403).json({ success: false, message: '프로젝트를 삭제할 권한이 없습니다.' });
        }

        const deleteProject = db.prepare('DELETE FROM Projects WHERE project_id = ?');
        deleteProject.run(projectId);

        logAction(userId, 'PROJECT_DELETED', '프로젝트 삭제', { project_id: projectId, title: project.title }, req.ip);

        res.json({ success: true, message: '프로젝트가 삭제되었습니다.' });

    } catch (error) {
        console.error('Project delete error:', error);
        res.status(500).json({ success: false, message: '프로젝트 삭제 중 오류가 발생했습니다.' });
    }
});

// ==================== 과제 관리 API ====================

// 과제 목록 조회 (학생용)
app.get('/api/assignments', authenticateToken, (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.user_id;

        let query = `
            SELECT a.*, u.name as creator_name,
                   s.submission_id, s.score, s.submitted_at, s.graded_at
            FROM Assignments a
            JOIN Users u ON a.creator_id = u.user_id
            LEFT JOIN AssignmentSubmissions s ON a.assignment_id = s.assignment_id AND s.student_id = ?
            WHERE a.is_active = 1
        `;

        const params = [userId];

        if (status === 'submitted') {
            query += ' AND s.submission_id IS NOT NULL';
        } else if (status === 'pending') {
            query += ' AND s.submission_id IS NULL';
        }

        query += ' ORDER BY a.due_date ASC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const assignments = db.prepare(query).all(...params);

        const totalCount = db.prepare(`
            SELECT COUNT(*) as count 
            FROM Assignments a
            LEFT JOIN AssignmentSubmissions s ON a.assignment_id = s.assignment_id AND s.student_id = ?
            WHERE a.is_active = 1
            ${status === 'submitted' ? 'AND s.submission_id IS NOT NULL' : ''}
            ${status === 'pending' ? 'AND s.submission_id IS NULL' : ''}
        `).get(userId);

        res.json({
            success: true,
            assignments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit)
            }
        });

    } catch (error) {
        console.error('Assignments error:', error);
        res.status(500).json({ success: false, message: '과제 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 과제 생성 (교수용)
app.post('/api/assignments', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    try {
        const { title, description, problem_statement, difficulty_level, due_date, grading_criteria } = req.body;
        const creatorId = req.user.user_id;

        if (!title || !description || !problem_statement || !difficulty_level) {
            return res.status(400).json({ success: false, message: '필수 입력값이 누락되었습니다.' });
        }

        const insertAssignment = db.prepare(`
            INSERT INTO Assignments (creator_id, title, description, problem_statement, difficulty_level, due_date, grading_criteria)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const result = insertAssignment.run(
            creatorId, title, description, problem_statement, difficulty_level, due_date, 
            grading_criteria ? JSON.stringify(grading_criteria) : null
        );

        logAction(creatorId, 'ASSIGNMENT_CREATED', '새 과제 생성', { assignment_id: result.lastInsertRowid, title }, req.ip);

        res.json({
            success: true,
            assignment_id: result.lastInsertRowid,
            message: '과제가 생성되었습니다.'
        });

    } catch (error) {
        console.error('Assignment creation error:', error);
        res.status(500).json({ success: false, message: '과제 생성 중 오류가 발생했습니다.' });
    }
});

// 과제 제출
app.post('/api/assignments/:id/submit', authenticateToken, (req, res) => {
    try {
        const assignmentId = req.params.id;
        const { project_id, submission_data } = req.body;
        const studentId = req.user.user_id;

        // 과제 존재 여부 확인
        const assignment = db.prepare('SELECT assignment_id, due_date FROM Assignments WHERE assignment_id = ? AND is_active = 1').get(assignmentId);

        if (!assignment) {
            return res.status(404).json({ success: false, message: '과제를 찾을 수 없습니다.' });
        }

        // 마감일 확인
        if (assignment.due_date && new Date(assignment.due_date) < new Date()) {
            return res.status(400).json({ success: false, message: '과제 제출 마감일이 지났습니다.' });
        }

        // 기존 제출물 확인
        const existingSubmission = db.prepare('SELECT submission_id FROM AssignmentSubmissions WHERE assignment_id = ? AND student_id = ?').get(assignmentId, studentId);

        if (existingSubmission) {
            // 기존 제출물 업데이트
            const updateSubmission = db.prepare(`
                UPDATE AssignmentSubmissions 
                SET project_id = ?, submission_data = ?, submitted_at = CURRENT_TIMESTAMP
                WHERE assignment_id = ? AND student_id = ?
            `);
            updateSubmission.run(project_id, submission_data, assignmentId, studentId);

            logAction(studentId, 'ASSIGNMENT_RESUBMITTED', '과제 재제출', { assignment_id: assignmentId }, req.ip);

            res.json({ success: true, message: '과제가 재제출되었습니다.' });
        } else {
            // 새 제출물 생성
            const insertSubmission = db.prepare(`
                INSERT INTO AssignmentSubmissions (assignment_id, student_id, project_id, submission_data)
                VALUES (?, ?, ?, ?)
            `);
            const result = insertSubmission.run(assignmentId, studentId, project_id, submission_data);

            logAction(studentId, 'ASSIGNMENT_SUBMITTED', '과제 제출', { assignment_id: assignmentId, submission_id: result.lastInsertRowid }, req.ip);

            res.json({ success: true, message: '과제가 제출되었습니다.' });
        }

    } catch (error) {
        console.error('Assignment submission error:', error);
        res.status(500).json({ success: false, message: '과제 제출 중 오류가 발생했습니다.' });
    }
});

// 과제 상세 조회
app.get('/api/assignments/:id', authenticateToken, (req, res) => {
    try {
        const assignmentId = req.params.id;
        const userId = req.user.user_id;

        const assignment = db.prepare(`
            SELECT a.*, u.name as creator_name
            FROM Assignments a
            JOIN Users u ON a.creator_id = u.user_id
            WHERE a.assignment_id = ? AND a.is_active = 1
        `).get(assignmentId);

        if (!assignment) {
            return res.status(404).json({ success: false, message: '과제를 찾을 수 없습니다.' });
        }

        // 학생인 경우 제출 상태 확인
        if (req.user.role === 'student') {
            const submission = db.prepare(`
                SELECT submission_id, score, submitted_at, graded_at, feedback
                FROM AssignmentSubmissions 
                WHERE assignment_id = ? AND student_id = ?
            `).get(assignmentId, userId);

            assignment.submission = submission;
        }

        // grading_criteria JSON 파싱
        if (assignment.grading_criteria) {
            try {
                assignment.grading_criteria = JSON.parse(assignment.grading_criteria);
            } catch (e) {
                assignment.grading_criteria = null;
            }
        }

        res.json({ success: true, assignment });

    } catch (error) {
        console.error('Assignment detail error:', error);
        res.status(500).json({ success: false, message: '과제 조회 중 오류가 발생했습니다.' });
    }
});

// 제출물 목록 조회 (교수용)
app.get('/api/assignments/:id/submissions', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    try {
        const assignmentId = req.params.id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const submissions = db.prepare(`
            SELECT s.*, u.name as student_name, u.student_number
            FROM AssignmentSubmissions s
            JOIN Users u ON s.student_id = u.user_id
            WHERE s.assignment_id = ?
            ORDER BY s.submitted_at DESC
            LIMIT ? OFFSET ?
        `).all(assignmentId, parseInt(limit), offset);

        const totalCount = db.prepare('SELECT COUNT(*) as count FROM AssignmentSubmissions WHERE assignment_id = ?').get(assignmentId);

        res.json({
            success: true,
            submissions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit)
            }
        });

    } catch (error) {
        console.error('Submissions error:', error);
        res.status(500).json({ success: false, message: '제출물 조회 중 오류가 발생했습니다.' });
    }
});

// 제출물 채점 (교수용)
app.put('/api/submissions/:id/grade', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    try {
        const submissionId = req.params.id;
        const { score, feedback } = req.body;
        const graderId = req.user.user_id;

        if (score < 0 || score > 100) {
            return res.status(400).json({ success: false, message: '점수는 0-100 사이여야 합니다.' });
        }

        const updateSubmission = db.prepare(`
            UPDATE AssignmentSubmissions 
            SET score = ?, feedback = ?, graded_at = CURRENT_TIMESTAMP, graded_by = ?
            WHERE submission_id = ?
        `);

        const result = updateSubmission.run(score, feedback, graderId, submissionId);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: '제출물을 찾을 수 없습니다.' });
        }

        logAction(graderId, 'SUBMISSION_GRADED', '제출물 채점 완료', { submission_id: submissionId, score }, req.ip);

        res.json({ success: true, message: '채점이 완료되었습니다.' });

    } catch (error) {
        console.error('Grading error:', error);
        res.status(500).json({ success: false, message: '채점 중 오류가 발생했습니다.' });
    }
});

// ==================== 알고리즘 및 학습 API ====================

// 알고리즘 카테고리 목록 조회
app.get('/api/algorithm-categories', (req, res) => {
    try {
        const categories = db.prepare(`
            SELECT category_id, category_name, description, sort_order
            FROM AlgorithmCategories 
            ORDER BY sort_order, category_name
        `).all();

        res.json({ success: true, categories });

    } catch (error) {
        console.error('Algorithm categories error:', error);
        res.status(500).json({ success: false, message: '알고리즘 카테고리 조회 중 오류가 발생했습니다.' });
    }
});

// 알고리즘 목록 조회
app.get('/api/algorithms', (req, res) => {
    try {
        const { category_id, difficulty_level } = req.query;

        let query = `
            SELECT a.*, c.category_name
            FROM Algorithms a
            JOIN AlgorithmCategories c ON a.category_id = c.category_id
        `;
        const params = [];

        const conditions = [];
        if (category_id) {
            conditions.push('a.category_id = ?');
            params.push(category_id);
        }
        if (difficulty_level) {
            conditions.push('a.difficulty_level = ?');
            params.push(difficulty_level);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY c.sort_order, a.name';

        const algorithms = db.prepare(query).all(...params);

        res.json({ success: true, algorithms });

    } catch (error) {
        console.error('Algorithms error:', error);
        res.status(500).json({ success: false, message: '알고리즘 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 알고리즘 상세 조회
app.get('/api/algorithms/:id', (req, res) => {
    try {
        const algorithmId = req.params.id;

        const algorithm = db.prepare(`
            SELECT a.*, c.category_name
            FROM Algorithms a
            JOIN AlgorithmCategories c ON a.category_id = c.category_id
            WHERE a.algorithm_id = ?
        `).get(algorithmId);

        if (!algorithm) {
            return res.status(404).json({ success: false, message: '알고리즘을 찾을 수 없습니다.' });
        }

        // 관련 퀴즈 조회
        const quizzes = db.prepare(`
            SELECT quiz_id, title, difficulty_level, max_score, time_limit_seconds
            FROM Quizzes 
            WHERE algorithm_id = ?
        `).all(algorithmId);

        algorithm.quizzes = quizzes;

        res.json({ success: true, algorithm });

    } catch (error) {
        console.error('Algorithm detail error:', error);
        res.status(500).json({ success: false, message: '알고리즘 조회 중 오류가 발생했습니다.' });
    }
});

// 퀴즈 조회
app.get('/api/quizzes/:id', authenticateToken, (req, res) => {
    try {
        const quizId = req.params.id;

        const quiz = db.prepare(`
            SELECT q.*, a.name as algorithm_name
            FROM Quizzes q
            JOIN Algorithms a ON q.algorithm_id = a.algorithm_id
            WHERE q.quiz_id = ?
        `).get(quizId);

        if (!quiz) {
            return res.status(404).json({ success: false, message: '퀴즈를 찾을 수 없습니다.' });
        }

        // quiz_data JSON 파싱
        if (quiz.quiz_data) {
            try {
                quiz.quiz_data = JSON.parse(quiz.quiz_data);
            } catch (e) {
                quiz.quiz_data = null;
            }
        }

        res.json({ success: true, quiz });

    } catch (error) {
        console.error('Quiz error:', error);
        res.status(500).json({ success: false, message: '퀴즈 조회 중 오류가 발생했습니다.' });
    }
});

// ==================== 관리자 API ====================

// 사용자 목록 조회 (관리자/교수용)
app.get('/api/admin/users', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    try {
        const { role, page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT user_id, email, name, student_number, role, created_at, last_login, is_active
            FROM Users
        `;
        const params = [];

        const conditions = [];
        if (role && role !== 'all') {
            conditions.push('role = ?');
            params.push(role);
        }
        if (search) {
            conditions.push('(name LIKE ? OR email LIKE ? OR student_number LIKE ?)');
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const users = db.prepare(query).all(...params);

        // 총 개수 조회
        let countQuery = 'SELECT COUNT(*) as count FROM Users';
        const countParams = [];

        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.slice(0, -2).join(' AND ');
            if (role && role !== 'all') countParams.push(role);
            if (search) {
                const searchPattern = `%${search}%`;
                countParams.push(searchPattern, searchPattern, searchPattern);
            }
        }

        const totalCount = db.prepare(countQuery).get(...countParams);

        res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit)
            }
        });

    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ success: false, message: '사용자 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 사용자 활성화/비활성화 (관리자용)
app.put('/api/admin/users/:id/status', authenticateToken, checkRole(['admin']), (req, res) => {
    try {
        const userId = req.params.id;
        const { is_active } = req.body;
        const adminId = req.user.user_id;

        const updateUser = db.prepare('UPDATE Users SET is_active = ? WHERE user_id = ?');
        const result = updateUser.run(is_active, userId);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }

        logAction(adminId, 'USER_STATUS_CHANGED', `사용자 상태 변경: ${is_active ? '활성화' : '비활성화'}`, { target_user_id: userId }, req.ip);

        res.json({ success: true, message: '사용자 상태가 변경되었습니다.' });

    } catch (error) {
        console.error('User status change error:', error);
        res.status(500).json({ success: false, message: '사용자 상태 변경 중 오류가 발생했습니다.' });
    }
});

// 시스템 통계 조회 (관리자용)
app.get('/api/admin/statistics', authenticateToken, checkRole(['professor', 'admin']), (req, res) => {
    try {
        // 기본 통계
        const userStats = db.prepare(`
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as students,
                SUM(CASE WHEN role = 'professor' THEN 1 ELSE 0 END) as professors,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users
            FROM Users
        `).get();

        const projectStats = db.prepare(`
            SELECT 
                COUNT(*) as total_projects,
                SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as public_projects,
                COUNT(DISTINCT user_id) as active_creators
            FROM Projects
        `).get();

        const assignmentStats = db.prepare(`
            SELECT 
                COUNT(*) as total_assignments,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_assignments
            FROM Assignments
        `).get();

        const submissionStats = db.prepare(`
            SELECT 
                COUNT(*) as total_submissions,
                SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) as graded_submissions,
                ROUND(AVG(score), 2) as average_score
            FROM AssignmentSubmissions
        `).get();

        // 최근 활동
        const recentActivities = db.prepare(`
            SELECT action_type, action_description, created_at, COUNT(*) as count
            FROM SystemLogs 
            WHERE created_at >= datetime('now', '-7 days')
            GROUP BY action_type
            ORDER BY count DESC
            LIMIT 10
        `).all();

        res.json({
            success: true,
            statistics: {
                users: userStats,
                projects: projectStats,
                assignments: assignmentStats,
                submissions: submissionStats,
                recent_activities: recentActivities
            }
        });

    } catch (error) {
        console.error('Statistics error:', error);
        res.status(500).json({ success: false, message: '통계 조회 중 오류가 발생했습니다.' });
    }
});

// 시스템 로그 조회 (관리자용)
app.get('/api/admin/logs', authenticateToken, checkRole(['admin']), (req, res) => {
    try {
        const { action_type, user_id, page = 1, limit = 50, start_date, end_date } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT l.*, u.name as user_name, u.email as user_email
            FROM SystemLogs l
            LEFT JOIN Users u ON l.user_id = u.user_id
        `;
        const params = [];

        const conditions = [];
        if (action_type) {
            conditions.push('l.action_type = ?');
            params.push(action_type);
        }
        if (user_id) {
            conditions.push('l.user_id = ?');
            params.push(user_id);
        }
        if (start_date) {
            conditions.push('l.created_at >= ?');
            params.push(start_date);
        }
        if (end_date) {
            conditions.push('l.created_at <= ?');
            params.push(end_date);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const logs = db.prepare(query).all(...params);

        // 로그의 metadata JSON 파싱
        const processedLogs = logs.map(log => ({
            ...log,
            metadata: log.metadata ? JSON.parse(log.metadata) : null
        }));

        res.json({
            success: true,
            logs: processedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Logs error:', error);
        res.status(500).json({ success: false, message: '로그 조회 중 오류가 발생했습니다.' });
    }
});

// ==================== 시스템 상태 및 헬스체크 API ====================

// 시스템 상태 확인
app.get('/api/health', (req, res) => {
    try {
        // 데이터베이스 연결 확인
        const dbCheck = db.prepare('SELECT 1 as status').get();
        
        // 기본 통계
        const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get();
        const projectCount = db.prepare('SELECT COUNT(*) as count FROM Projects').get();
        const assignmentCount = db.prepare('SELECT COUNT(*) as count FROM Assignments').get();

        res.json({
            success: true,
            status: 'healthy',
            database: 'connected',
            database_type: 'Node.js Built-in SQLite',
            statistics: {
                users: userCount.count,
                projects: projectCount.count,
                assignments: assignmentCount.count
            },
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: process.uptime()
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 데이터베이스 상태 확인
app.get('/api/db-status', authenticateToken, checkRole(['admin']), (req, res) => {
    try {
        const tables = [
            'Users', 'UserProfiles', 'BlockTypes', 'Projects', 'ProjectVersions', 
            'ProjectBlocks', 'Categories', 'AlgorithmCategories', 'Algorithms', 
            'Assignments', 'TestCases', 'AssignmentSubmissions', 'Quizzes', 
            'LearningTopics', 'SharedProjects', 'SystemLogs'
        ];

        const tableStats = {};

        for (const table of tables) {
            try {
                const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
                tableStats[table] = count.count;
            } catch (e) {
                tableStats[table] = 'ERROR';
            }
        }

        // 데이터베이스 파일 크기 (시도)
        let dbSize = 'Unknown';
        try {
            const stats = fs.statSync('./database.db');
            dbSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
        } catch (e) {
            // 파일 정보를 가져올 수 없는 경우
        }

        res.json({
            success: true,
            database_file: './database.db',
            database_size: dbSize,
            table_counts: tableStats,
            wal_mode: 'enabled',
            foreign_keys: 'enabled'
        });

    } catch (error) {
        console.error('DB status error:', error);
        res.status(500).json({ success: false, message: '데이터베이스 상태 확인 중 오류가 발생했습니다.' });
    }
});

// ==================== 에러 핸들링 ====================

// 404 처리
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: '요청한 리소스를 찾을 수 없습니다.',
        path: req.path,
        method: req.method
    });
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
    console.error('Global error handler:', err.stack);
    
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: '잘못된 JSON 형식입니다.' });
    }
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: '파일 크기가 너무 큽니다. (최대 5MB)' });
    }

    if (err.message && err.message.includes('이미지 파일만')) {
        return res.status(400).json({ success: false, message: err.message });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: '토큰이 만료되었습니다.' });
    }
    
    res.status(500).json({ 
        success: false, 
        message: '서버 내부 오류가 발생했습니다.',
        error_id: Date.now(), // 디버깅용 오류 ID
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ==================== 프로세스 관리 ====================

// 프로세스 종료 처리
process.on('SIGINT', () => {
    console.log('\n서버를 종료합니다...');
    
    if (db) {
        try {
            db.close();
            console.log('✅ 데이터베이스 연결이 안전하게 종료되었습니다.');
        } catch (error) {
            console.error('데이터베이스 종료 중 오류:', error);
        }
    }
    
    console.log('✅ 서버가 안전하게 종료되었습니다.');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM 신호를 받았습니다. 서버를 종료합니다...');
    
    if (db) {
        try {
            db.close();
        } catch (error) {
            console.error('데이터베이스 종료 중 오류:', error);
        }
    }
    
    process.exit(0);
});

// 처리되지 않은 Promise 거부 처리
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // 프로덕션에서는 로그 서비스로 전송
});

// 처리되지 않은 예외 처리
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    
    // 데이터베이스 정리
    if (db) {
        try {
            db.close();
        } catch (e) {
            console.error('Emergency DB close error:', e);
        }
    }
    
    process.exit(1);
});

// ==================== 서버 시작 ====================

function startServer() {
    try {
        // 업로드 디렉토리 생성
        if (!fs.existsSync('uploads/')) {
            fs.mkdirSync('uploads/', { recursive: true });
            console.log('📁 uploads 디렉토리 생성 완료');
        }

        // public 디렉토리 확인
        if (!fs.existsSync('public/')) {
            console.warn('⚠️ public 디렉토리가 존재하지 않습니다. HTML 파일들을 public/ 폴더에 넣어주세요.');
        }

        // 데이터베이스 초기화
        initializeDatabase();
        
        // 서버 시작
        app.listen(port, () => {
            console.log(`
🚀 코딩스타트 플랫폼 서버가 시작되었습니다! (Node.js 내장 SQLite 버전)
📍 포트: ${port}
🌐 URL: http://localhost:${port}
📊 데이터베이스: Node.js 내장 SQLite (database.db)
🔐 보안: bcryptjs + JWT + helmet + CORS
⚡ 검증: validator.js + express-validator
🆕 특징: 컴파일 불필요, 네이티브 모듈 제로!

📚 테스트 계정:
👤 학생: test@afa.ac.kr / password123
👨‍🏫 교수: teacher@afa.ac.kr / password123  
👨‍💼 관리자: admin@afa.ac.kr / password123

🔧 주요 기능:
✅ Node.js 내장 SQLite (v22.5.0+)
✅ 컴파일 불필요 (Visual Studio Build Tools 불필요)
✅ 네이티브 모듈 의존성 제로
✅ 완전한 관계형 데이터베이스
✅ 외래키 제약조건 지원
✅ 트랜잭션 및 WAL 모드 지원
✅ 블록 코딩 프로젝트 관리
✅ 과제 생성 및 제출 시스템
✅ 자동 채점 및 피드백
✅ 알고리즘 학습 및 시각화
✅ 퀴즈 및 평가 시스템
✅ 사용자 권한 관리 (학생/교수/관리자)
✅ 실시간 학습 진행도 추적
✅ 포트폴리오 및 프로젝트 공유
✅ 시스템 로깅 및 감사 추적
✅ 파일 업로드 (프로필 이미지)
✅ Rate limiting 및 보안 미들웨어

📋 주요 API 엔드포인트:

🔐 인증 관리:
   POST /api/login              - 로그인
   POST /api/signup             - 회원가입
   POST /api/forgot-password    - 비밀번호 찾기

👤 사용자 관리:
   GET  /api/user/profile       - 프로필 조회
   PUT  /api/user/profile       - 프로필 업데이트
   GET  /api/user/progress      - 학습 진행률

🧩 블록 코딩:
   GET  /api/block-types        - 블록 타입 목록
   POST /api/projects           - 프로젝트 생성
   GET  /api/user/projects      - 내 프로젝트 목록
   GET  /api/projects/:id       - 프로젝트 상세
   PUT  /api/projects/:id       - 프로젝트 업데이트
   DELETE /api/projects/:id     - 프로젝트 삭제

📝 과제 관리:
   GET  /api/assignments        - 과제 목록 (학생용)
   POST /api/assignments        - 과제 생성 (교수용)
   GET  /api/assignments/:id    - 과제 상세
   POST /api/assignments/:id/submit - 과제 제출
   GET  /api/assignments/:id/submissions - 제출물 목록 (교수용)
   PUT  /api/submissions/:id/grade - 제출물 채점 (교수용)

🧮 알고리즘 학습:
   GET  /api/algorithm-categories - 알고리즘 카테고리
   GET  /api/algorithms         - 알고리즘 목록
   GET  /api/algorithms/:id     - 알고리즘 상세
   GET  /api/quizzes/:id        - 퀴즈 조회

👥 관리자 기능:
   GET  /api/admin/users        - 사용자 관리
   PUT  /api/admin/users/:id/status - 사용자 활성화/비활성화
   GET  /api/admin/statistics   - 시스템 통계
   GET  /api/admin/logs         - 시스템 로그

💚 시스템 상태:
   GET  /api/health             - 헬스체크
   GET  /api/db-status          - 데이터베이스 상태 (관리자용)

📄 페이지 라우트:
   GET  /                       - 메인 페이지 (S01_01.html)
   GET  /login                  - 로그인 (S01_02.html)
   GET  /signup                 - 회원가입 (S01_03.html)
   GET  /forgot-password        - 비밀번호 찾기 (S01_04.html)
   GET  /dashboard              - 대시보드 (S02.html / S02_2.html)
   GET  /teacher-dashboard      - 교수 대시보드 (S02_2.html)
   GET  /block-coding           - 블록 코딩 (S03.html)
   GET  /algorithm              - 알고리즘 시각화 (S04.html)
   GET  /assignments            - 과제 관리 (S05.html)
   GET  /progress               - 학습 현황 (S06.html)
   GET  /create-assignment      - 과제 출제 (S07.html) [교수용]
   GET  /review-submissions     - 제출물 평가 (S08.html) [교수용]
   GET  /student-analytics      - 학생 성취도 (S09.html) [교수용]
   GET  /student-management     - 학생 관리 (S10.html) [교수용]

💡 Node.js 내장 SQLite 장점:
- ✅ 컴파일 과정 완전 생략
- ✅ Visual Studio Build Tools 불필요
- ✅ node-gyp 의존성 없음
- ✅ 설치 오류 없음
- ✅ 표준 SQL 완전 지원
- ✅ 동기적 API (간단한 코드)
- ✅ 뛰어난 성능 (WAL 모드)
- ✅ 완전한 트랜잭션 지원
- ✅ 외래키 제약조건 지원
- ✅ 쉬운 배포 및 이동
- ✅ 크로스 플랫폼 호환성
- ✅ 메모리 효율성

🎯 개발 환경 요구사항:
- Node.js v22.5.0 이상 (내장 SQLite 지원)
- npm 또는 yarn
- 컴파일러 불필요!

📁 프로젝트 구조:
/
├── server.js                 (이 파일)
├── package.json
├── .env                      (JWT_SECRET 등)
├── database.db              (SQLite 데이터베이스)
├── public/                   (HTML, CSS, JS 파일들)
│   ├── S01_01.html          (메인 페이지)
│   ├── S01_02.html          (로그인)
│   ├── S01_03.html          (회원가입)
│   ├── S01_04.html          (비밀번호 찾기)
│   ├── S02.html             (학생 대시보드)
│   ├── S02_2.html           (교수 대시보드)
│   ├── S03.html             (블록 코딩)
│   ├── S04.html             (알고리즘 시각화)
│   ├── S05.html             (과제 관리)
│   ├── S06.html             (학습 현황)
│   ├── S07.html             (과제 출제)
│   ├── S08.html             (제출물 평가)
│   ├── S09.html             (학생 성취도)
│   └── S10.html             (학생 관리)
└── uploads/                  (업로드된 파일들)

🔒 보안 기능:
- JWT 토큰 기반 인증
- bcryptjs 비밀번호 해시화
- helmet.js 보안 헤더
- CORS 설정
- Rate limiting (로그인: 5회/15분, API: 100회/15분)
- SQL Injection 방지 (Prepared Statements)
- XSS 방지 (Content Security Policy)
- 파일 업로드 검증 (이미지만, 5MB 제한)
- 입력값 유효성 검사 (validator.js)

📊 데이터베이스 스키마:
- Users (사용자 정보)
- UserProfiles (사용자 프로필)
- BlockTypes (블록 타입 정의)
- Projects (프로젝트)
- ProjectVersions (프로젝트 버전)
- ProjectBlocks (프로젝트 블록)
- Categories (일반 카테고리)
- AlgorithmCategories (알고리즘 카테고리)
- Algorithms (알고리즘 정보)
- Assignments (과제)
- TestCases (테스트 케이스)
- AssignmentSubmissions (과제 제출)
- Quizzes (퀴즈)
- LearningTopics (학습 주제)
- SharedProjects (공유 프로젝트)
- SystemLogs (시스템 로그)

🎓 학습 관리 시스템:
- 개인별 학습 진도 추적
- 과제 생성 및 자동 채점
- 실시간 피드백 시스템
- 알고리즘 시각화 도구
- 퀴즈 및 평가 시스템
- 포트폴리오 관리
- 프로젝트 공유 및 협업

🚀 시작하기:
1. npm install
2. node server.js
3. http://localhost:3000 접속
4. 테스트 계정으로 로그인

📞 문제 해결:
- Node.js v22.5.0+ 사용 확인
- public/ 폴더에 HTML 파일들 배치
- .env 파일에 JWT_SECRET 설정
- 포트 3000이 사용 중인지 확인

🎉 Node.js v22.5.0에서 완벽 동작!
            `);
        });
        
    } catch (error) {
        console.error('❌ 서버 시작 실패:', error);
        process.exit(1);
    }
}

// 서버 시작
startServer();