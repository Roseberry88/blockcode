const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JsonDB, Config } = require('node-json-db');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult, param } = require('express-validator');
const multer = require('multer');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// JSON 데이터베이스 초기화 (SQLite 대신)
const db = new JsonDB(new Config("database", true, false, '/'));

// 미들웨어 설정
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : true,
    credentials: true
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' }
});
app.use('/api/', limiter);

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: '너무 많은 로그인 시도입니다.' }
});

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
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

// 데이터베이스 구조 초기화
function initializeDatabase() {
    console.log('🗄️  JSON 데이터베이스를 초기화합니다...');

    try {
        // 기본 구조 생성
        const defaultData = {
            users: [],
            user_profiles: [],
            block_types: [],
            projects: [],
            project_versions: [],
            project_blocks: [],
            algorithm_categories: [],
            algorithms: [],
            assignments: [],
            test_cases: [],
            assignment_submissions: [],
            system_logs: [],
            counters: {
                user_id: 1,
                project_id: 1,
                version_id: 1,
                block_id: 1,
                assignment_id: 1,
                test_case_id: 1,
                submission_id: 1,
                log_id: 1
            }
        };

        // 데이터베이스가 비어있으면 초기화
        try {
            db.getData("/users");
        } catch (error) {
            // 데이터가 없으면 초기 구조 생성
            db.push("/", defaultData);
            console.log('✅ 기본 데이터베이스 구조 생성 완료');
        }

        // 초기 데이터 삽입
        insertInitialData();

    } catch (error) {
        console.error('❌ 데이터베이스 초기화 오류:', error);
        process.exit(1);
    }
}

// 초기 데이터 삽입
function insertInitialData() {
    try {
        console.log('📝 초기 데이터를 삽입합니다...');

        // 기존 사용자 확인
        const users = db.getData("/users");
        const existingUser = users.find(u => u.email === 'admin@afa.ac.kr');
        
        if (!existingUser) {
            const hashedPassword = bcrypt.hashSync('password123', 10);
            const now = new Date().toISOString();
            
            // 테스트 사용자 생성
            const newUsers = [
                {
                    user_id: getNextId('user_id'),
                    email: 'test@afa.ac.kr',
                    password_hash: hashedPassword,
                    name: '김준호',
                    student_number: '20240001',
                    role: 'student',
                    profile_image_url: null,
                    created_at: now,
                    updated_at: now,
                    last_login: null,
                    is_active: true
                },
                {
                    user_id: getNextId('user_id'),
                    email: 'teacher@afa.ac.kr',
                    password_hash: hashedPassword,
                    name: '유승훈',
                    student_number: '19980001',
                    role: 'professor',
                    profile_image_url: null,
                    created_at: now,
                    updated_at: now,
                    last_login: null,
                    is_active: true
                },
                {
                    user_id: getNextId('user_id'),
                    email: 'admin@afa.ac.kr',
                    password_hash: hashedPassword,
                    name: '관리자',
                    student_number: '19900001',
                    role: 'admin',
                    profile_image_url: null,
                    created_at: now,
                    updated_at: now,
                    last_login: null,
                    is_active: true
                }
            ];

            // 사용자 추가
            newUsers.forEach(user => {
                db.push("/users[]", user, true);
                
                // 사용자 프로필 생성
                db.push("/user_profiles[]", {
                    profile_id: getNextId('profile_id'),
                    user_id: user.user_id,
                    coding_experience: null,
                    learning_preferences: null,
                    bio: null,
                    created_at: now,
                    updated_at: now
                }, true);
            });

            console.log('✅ 기본 사용자 계정 생성 완료');
        }

        // 블록 타입 초기 데이터
        const blockTypes = db.getData("/block_types");
        if (blockTypes.length === 0) {
            const initialBlockTypes = [
                {
                    block_type_id: getNextId('block_type_id'),
                    type_name: 'print',
                    category: 'output',
                    description: '텍스트 출력 블록',
                    default_properties: JSON.stringify({color: "#4CAF50", shape: "rounded"}),
                    created_at: new Date().toISOString()
                },
                {
                    block_type_id: getNextId('block_type_id'),
                    type_name: 'variable',
                    category: 'data',
                    description: '변수 선언 블록',
                    default_properties: JSON.stringify({color: "#FF9800", shape: "rounded"}),
                    created_at: new Date().toISOString()
                },
                {
                    block_type_id: getNextId('block_type_id'),
                    type_name: 'input',
                    category: 'input',
                    description: '사용자 입력 블록',
                    default_properties: JSON.stringify({color: "#2196F3", shape: "rounded"}),
                    created_at: new Date().toISOString()
                },
                {
                    block_type_id: getNextId('block_type_id'),
                    type_name: 'if_statement',
                    category: 'control',
                    description: '조건문 블록',
                    default_properties: JSON.stringify({color: "#F44336", shape: "c_shape"}),
                    created_at: new Date().toISOString()
                },
                {
                    block_type_id: getNextId('block_type_id'),
                    type_name: 'for_loop',
                    category: 'control',
                    description: '반복문 블록',
                    default_properties: JSON.stringify({color: "#9C27B0", shape: "c_shape"}),
                    created_at: new Date().toISOString()
                },
                {
                    block_type_id: getNextId('block_type_id'),
                    type_name: 'math_operation',
                    category: 'math',
                    description: '수학 연산 블록',
                    default_properties: JSON.stringify({color: "#607D8B", shape: "rounded"}),
                    created_at: new Date().toISOString()
                },
                {
                    block_type_id: getNextId('block_type_id'),
                    type_name: 'comment',
                    category: 'utility',
                    description: '주석 블록',
                    default_properties: JSON.stringify({color: "#9E9E9E", shape: "note"}),
                    created_at: new Date().toISOString()
                }
            ];

            initialBlockTypes.forEach(blockType => {
                db.push("/block_types[]", blockType, true);
            });

            console.log('✅ 기본 블록 타입 생성 완료');
        }

        // 알고리즘 카테고리
        const categories = db.getData("/algorithm_categories");
        if (categories.length === 0) {
            const initialCategories = [
                {
                    category_id: getNextId('category_id'),
                    category_name: 'sorting',
                    description: '정렬 알고리즘',
                    sort_order: 1,
                    created_at: new Date().toISOString()
                },
                {
                    category_id: getNextId('category_id'),
                    category_name: 'searching',
                    description: '탐색 알고리즘',
                    sort_order: 2,
                    created_at: new Date().toISOString()
                },
                {
                    category_id: getNextId('category_id'),
                    category_name: 'graph',
                    description: '그래프 알고리즘',
                    sort_order: 3,
                    created_at: new Date().toISOString()
                }
            ];

            initialCategories.forEach(category => {
                db.push("/algorithm_categories[]", category, true);
            });

            console.log('✅ 알고리즘 카테고리 생성 완료');
        }

        console.log('🎉 초기 데이터 삽입 완료');

    } catch (error) {
        console.error('❌ 초기 데이터 삽입 오류:', error);
    }
}

// ID 생성 헬퍼 함수
function getNextId(counterName) {
    try {
        const currentId = db.getData(`/counters/${counterName}`);
        const nextId = currentId + 1;
        db.push(`/counters/${counterName}`, nextId);
        return nextId;
    } catch (error) {
        // 카운터가 없으면 초기화
        db.push(`/counters/${counterName}`, 2);
        return 1;
    }
}

// JWT 토큰 검증 미들웨어
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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

// 유효성 검사 결과 확인 미들웨어
function validateRequest(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: '입력값 검증 실패',
            errors: errors.array()
        });
    }
    next();
}

// 시스템 로그 기록 함수
function logAction(userId, actionType, description, metadata = {}, ipAddress = null) {
    try {
        const logEntry = {
            log_id: getNextId('log_id'),
            user_id: userId,
            action_type: actionType,
            action_description: description,
            metadata: JSON.stringify(metadata),
            ip_address: ipAddress,
            created_at: new Date().toISOString()
        };
        db.push("/system_logs[]", logEntry, true);
    } catch (error) {
        console.error('로그 기록 오류:', error);
    }
}

// 기본 페이지 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S01_01.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S01_02.html'));
});

app.get('/dashboard', authenticateToken, (req, res) => {
    if (req.user.role === 'professor' || req.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'public/S02_2.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/S02.html'));
    }
});

// ==================== 사용자 관리 API ====================

// 로그인 API
app.post('/api/login', 
    loginLimiter,
    [
        body('email').isEmail().withMessage('유효한 이메일을 입력해주세요.'),
        body('password').isLength({ min: 6 }).withMessage('비밀번호는 최소 6자 이상이어야 합니다.')
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { email, password } = req.body;

            const users = db.getData("/users");
            const user = users.find(u => u.email === email && u.is_active);

            if (!user) {
                logAction(null, 'LOGIN_FAILED', `Failed login attempt for email: ${email}`, {}, req.ip);
                return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
            }

            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                logAction(user.user_id, 'LOGIN_FAILED', 'Invalid password', {}, req.ip);
                return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
            }

            // 로그인 시간 업데이트
            const userIndex = users.findIndex(u => u.user_id === user.user_id);
            db.push(`/users[${userIndex}]/last_login`, new Date().toISOString());

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

            logAction(user.user_id, 'LOGIN_SUCCESS', 'User logged in successfully', {}, req.ip);

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
    }
);

// 회원가입 API
app.post('/api/signup',
    [
        body('email').isEmail().withMessage('유효한 이메일을 입력해주세요.'),
        body('password').isLength({ min: 6 }).withMessage('비밀번호는 최소 6자 이상이어야 합니다.'),
        body('name').isLength({ min: 2 }).withMessage('이름은 최소 2자 이상이어야 합니다.'),
        body('student_number').optional().isLength({ min: 6 }).withMessage('학번은 최소 6자 이상이어야 합니다.'),
        body('role').isIn(['student', 'professor']).withMessage('올바른 역할을 선택해주세요.')
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { email, password, name, student_number, role } = req.body;

            const users = db.getData("/users");
            
            // 이메일 중복 체크
            const existingUser = users.find(u => u.email === email);
            if (existingUser) {
                return res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
            }

            // 학번 중복 체크
            if (student_number) {
                const existingStudent = users.find(u => u.student_number === student_number);
                if (existingStudent) {
                    return res.status(409).json({ success: false, message: '이미 사용 중인 학번입니다.' });
                }
            }

            const hashedPassword = await bcrypt.hash(password, 12);
            const now = new Date().toISOString();
            const userId = getNextId('user_id');

            const newUser = {
                user_id: userId,
                email,
                password_hash: hashedPassword,
                name,
                student_number,
                role,
                profile_image_url: null,
                created_at: now,
                updated_at: now,
                last_login: null,
                is_active: true
            };

            // 사용자 추가
            db.push("/users[]", newUser, true);

            // 사용자 프로필 생성
            const newProfile = {
                profile_id: getNextId('profile_id'),
                user_id: userId,
                coding_experience: null,
                learning_preferences: null,
                bio: null,
                created_at: now,
                updated_at: now
            };
            db.push("/user_profiles[]", newProfile, true);

            logAction(userId, 'USER_REGISTERED', 'New user registered', { email, role }, req.ip);
            res.status(201).json({ success: true, message: '회원가입이 완료되었습니다.' });

        } catch (error) {
            console.error('Signup error:', error);
            res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
        }
    }
);

// 사용자 정보 조회 API
app.get('/api/user/profile', authenticateToken, (req, res) => {
    try {
        const userId = req.user.user_id;

        const users = db.getData("/users");
        const user = users.find(u => u.user_id === userId);

        if (!user) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }

        // 사용자 프로필 정보 조회
        const profiles = db.getData("/user_profiles");
        const profile = profiles.find(p => p.user_id === userId);

        // 비밀번호 해시 제거
        const { password_hash, ...userWithoutPassword } = user;
        
        const userWithProfile = {
            ...userWithoutPassword,
            coding_experience: profile?.coding_experience || null,
            learning_preferences: profile?.learning_preferences || null,
            bio: profile?.bio || null
        };
        
        res.json({ success: true, user: userWithProfile });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, message: '사용자 정보 조회 중 오류가 발생했습니다.' });
    }
});

// ==================== 블록 관리 API ====================

// 블록 타입 목록 조회 API
app.get('/api/block-types', authenticateToken, (req, res) => {
    try {
        const { category } = req.query;
        
        let blockTypes = db.getData("/block_types");
        
        if (category) {
            blockTypes = blockTypes.filter(bt => bt.category === category);
        }
        
        // JSON 문자열을 객체로 파싱
        const processedBlockTypes = blockTypes.map(bt => ({
            ...bt,
            default_properties: bt.default_properties ? JSON.parse(bt.default_properties) : {}
        }));

        // 카테고리, 타입명으로 정렬
        processedBlockTypes.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.type_name.localeCompare(b.type_name);
        });

        res.json({ success: true, blockTypes: processedBlockTypes });
    } catch (error) {
        console.error('BlockTypes error:', error);
        res.status(500).json({ success: false, message: '블록 타입 조회 중 오류가 발생했습니다.' });
    }
});

// ==================== 프로젝트 관리 API ====================

// 프로젝트 목록 조회 API
app.get('/api/projects', authenticateToken, (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10, search = '', is_public } = req.query;
        const offset = (page - 1) * limit;

        let projects = db.getData("/projects");
        const users = db.getData("/users");

        // 권한에 따른 필터링
        if (req.user.role === 'student') {
            projects = projects.filter(p => p.user_id === userId);
        } else if (is_public !== undefined) {
            projects = projects.filter(p => p.is_public === (is_public === 'true'));
        }

        // 검색 필터링
        if (search) {
            projects = projects.filter(p => 
                p.title.toLowerCase().includes(search.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
            );
        }

        // 작성자 정보 추가
        const projectsWithAuthor = projects.map(project => {
            const author = users.find(u => u.user_id === project.user_id);
            return {
                ...project,
                author_name: author ? author.name : 'Unknown'
            };
        });

        // 정렬 (최신순)
        projectsWithAuthor.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        // 페이지네이션
        const totalProjects = projectsWithAuthor.length;
        const paginatedProjects = projectsWithAuthor.slice(offset, offset + parseInt(limit));

        res.json({
            success: true,
            projects: paginatedProjects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalProjects,
                totalPages: Math.ceil(totalProjects / limit)
            }
        });
    } catch (error) {
        console.error('Projects error:', error);
        res.status(500).json({ success: false, message: '프로젝트 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 프로젝트 생성 API
app.post('/api/projects',
    authenticateToken,
    [
        body('title').isLength({ min: 1, max: 100 }).withMessage('제목은 1-100자 사이여야 합니다.'),
        body('description').optional().isLength({ max: 500 }).withMessage('설명은 500자 이하여야 합니다.'),
        body('language').optional().isIn(['python', 'javascript', 'java', 'c++', 'scratch']).withMessage('지원되는 언어를 선택해주세요.'),
        body('is_public').optional().isBoolean().withMessage('공개 여부는 boolean 값이어야 합니다.')
    ],
    validateRequest,
    (req, res) => {
        try {
            const userId = req.user.user_id;
            const { title, description, language = 'python', is_public = false } = req.body;
            const now = new Date().toISOString();

            // 프로젝트 생성
            const projectId = getNextId('project_id');
            const newProject = {
                project_id: projectId,
                user_id: userId,
                title,
                description: description || null,
                language,
                is_public: is_public,
                created_at: now,
                updated_at: now,
                last_modified: now
            };

            db.push("/projects[]", newProject, true);

            // 초기 버전 생성
            const versionId = getNextId('version_id');
            const newVersion = {
                version_id: versionId,
                project_id: projectId,
                version_number: 1,
                change_description: '초기 버전',
                created_at: now
            };

            db.push("/project_versions[]", newVersion, true);
            
            logAction(userId, 'PROJECT_CREATED', 'New project created', { projectId, title }, req.ip);
            
            res.status(201).json({ 
                success: true, 
                message: '프로젝트가 생성되었습니다.',
                project: {
                    project_id: projectId,
                    version_id: versionId,
                    title,
                    description,
                    language,
                    is_public
                }
            });
        } catch (error) {
            console.error('Project creation error:', error);
            res.status(500).json({ success: false, message: '프로젝트 생성 중 오류가 발생했습니다.' });
        }
    }
);

// ==================== 알고리즘 관리 API ====================

// 알고리즘 카테고리 목록 조회 API
app.get('/api/algorithm-categories', authenticateToken, (req, res) => {
    try {
        const categories = db.getData("/algorithm_categories");
        
        // 정렬
        categories.sort((a, b) => {
            if (a.sort_order !== b.sort_order) {
                return a.sort_order - b.sort_order;
            }
            return a.category_name.localeCompare(b.category_name);
        });

        res.json({ success: true, categories });
    } catch (error) {
        console.error('Algorithm categories error:', error);
        res.status(500).json({ success: false, message: '카테고리 조회 중 오류가 발생했습니다.' });
    }
});

// 알고리즘 목록 조회 API
app.get('/api/algorithms', authenticateToken, (req, res) => {
    try {
        const { category_id, difficulty_level, search } = req.query;

        let algorithms = db.getData("/algorithms");
        const categories = db.getData("/algorithm_categories");

        // 필터링
        if (category_id) {
            algorithms = algorithms.filter(a => a.category_id === parseInt(category_id));
        }

        if (difficulty_level) {
            algorithms = algorithms.filter(a => a.difficulty_level === difficulty_level);
        }

        if (search) {
            algorithms = algorithms.filter(a => 
                a.name.toLowerCase().includes(search.toLowerCase()) ||
                a.description.toLowerCase().includes(search.toLowerCase())
            );
        }

        // 카테고리 정보 추가
        const algorithmsWithCategory = algorithms.map(algorithm => {
            const category = categories.find(c => c.category_id === algorithm.category_id);
            return {
                ...algorithm,
                category_name: category ? category.category_name : 'Unknown'
            };
        });

        // 정렬
        algorithmsWithCategory.sort((a, b) => {
            const categoryA = categories.find(c => c.category_id === a.category_id);
            const categoryB = categories.find(c => c.category_id === b.category_id);
            
            if (categoryA?.sort_order !== categoryB?.sort_order) {
                return (categoryA?.sort_order || 0) - (categoryB?.sort_order || 0);
            }
            
            const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 };
            if (difficultyOrder[a.difficulty_level] !== difficultyOrder[b.difficulty_level]) {
                return difficultyOrder[a.difficulty_level] - difficultyOrder[b.difficulty_level];
            }
            
            return a.name.localeCompare(b.name);
        });

        res.json({ success: true, algorithms: algorithmsWithCategory });
    } catch (error) {
        console.error('Algorithms error:', error);
        res.status(500).json({ success: false, message: '알고리즘 목록 조회 중 오류가 발생했습니다.' });
    }
});

// ==================== 과제 관리 API ====================

// 과제 목록 조회 API
app.get('/api/assignments', authenticateToken, (req, res) => {
    try {
        const userId = req.user.user_id;
        const { status, difficulty_level, search } = req.query;

        let assignments = db.getData("/assignments");
        const users = db.getData("/users");
        const submissions = db.getData("/assignment_submissions");

        // 권한에 따른 필터링
        if (req.user.role === 'professor') {
            assignments = assignments.filter(a => a.creator_id === userId);
        } else if (req.user.role === 'student') {
            // 학생은 활성 과제만 볼 수 있음
            assignments = assignments.filter(a => a.is_active);
        }

        // 추가 필터링
        if (difficulty_level) {
            assignments = assignments.filter(a => a.difficulty_level === difficulty_level);
        }

        if (search) {
            assignments = assignments.filter(a => 
                a.title.toLowerCase().includes(search.toLowerCase()) ||
                a.description.toLowerCase().includes(search.toLowerCase())
            );
        }

        // 작성자 정보 및 제출 정보 추가
        const assignmentsWithInfo = assignments.map(assignment => {
            const creator = users.find(u => u.user_id === assignment.creator_id);
            
            if (req.user.role === 'student') {
                // 학생용: 본인의 제출 현황
                const userSubmission = submissions.find(s => 
                    s.assignment_id === assignment.assignment_id && s.user_id === userId
                );
                
                return {
                    ...assignment,
                    creator_name: creator ? creator.name : 'Unknown',
                    submission_id: userSubmission?.submission_id || null,
                    score: userSubmission?.score || null,
                    submission_status: userSubmission?.status || null,
                    submitted_at: userSubmission?.submitted_at || null,
                    graded_at: userSubmission?.graded_at || null
                };
            } else {
                // 교수/관리자용: 제출 통계
                const assignmentSubmissions = submissions.filter(s => s.assignment_id === assignment.assignment_id);
                const scores = assignmentSubmissions.map(s => s.score).filter(s => s !== null);
                
                return {
                    ...assignment,
                    creator_name: creator ? creator.name : 'Unknown',
                    submission_count: assignmentSubmissions.length,
                    average_score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
                };
            }
        });

        // 정렬 (최신순)
        assignmentsWithInfo.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({ success: true, assignments: assignmentsWithInfo });
    } catch (error) {
        console.error('Assignments error:', error);
        res.status(500).json({ success: false, message: '과제 목록 조회 중 오류가 발생했습니다.' });
    }
});

// ==================== 시스템 관리 API ====================

// 시스템 통계 조회 API
app.get('/api/admin/statistics', authenticateToken, checkRole(['admin', 'professor']), (req, res) => {
    try {
        const { period = '30' } = req.query;
        const periodDays = parseInt(period);
        const periodDate = new Date();
        periodDate.setDate(periodDate.getDate() - periodDays);

        const users = db.getData("/users");
        const projects = db.getData("/projects");
        const assignments = db.getData("/assignments");
        const submissions = db.getData("/assignment_submissions");

        // 사용자 통계
        const userStats = {
            total_users: users.filter(u => u.is_active).length,
            students: users.filter(u => u.role === 'student' && u.is_active).length,
            professors: users.filter(u => u.role === 'professor' && u.is_active).length,
            active_users: users.filter(u => 
                u.last_login && new Date(u.last_login) >= periodDate
            ).length
        };

        // 프로젝트 통계
        const projectStats = {
            total_projects: projects.length,
            recent_projects: projects.filter(p => 
                new Date(p.created_at) >= periodDate
            ).length,
            public_projects: projects.filter(p => p.is_public).length
        };

        // 과제 통계
        const assignmentStats = {
            total_assignments: assignments.length,
            recent_assignments: assignments.filter(a => 
                new Date(a.created_at) >= periodDate
            ).length,
            active_assignments: assignments.filter(a => a.is_active).length
        };

        // 제출물 통계
        const submissionStats = {
            total_submissions: submissions.length,
            recent_submissions: submissions.filter(s => 
                new Date(s.submitted_at) >= periodDate
            ).length,
            average_score: submissions.length > 0 ? 
                submissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissions.length : 0
        };

        res.json({
            success: true,
            statistics: {
                users: userStats,
                projects: projectStats,
                assignments: assignmentStats,
                submissions: submissionStats,
                period_days: periodDays
            }
        });
    } catch (error) {
        console.error('Statistics error:', error);
        res.status(500).json({ success: false, message: '통계 조회 중 오류가 발생했습니다.' });
    }
});

// ==================== 추가 API ====================

// 과제 상세 조회 API
app.get('/api/assignments/:id',
    authenticateToken,
    [param('id').isInt().withMessage('유효한 과제 ID를 입력해주세요.')],
    validateRequest,
    (req, res) => {
        try {
            const assignmentId = parseInt(req.params.id);
            
            const assignments = db.getData("/assignments");
            const assignment = assignments.find(a => a.assignment_id === assignmentId);
            
            if (!assignment) {
                return res.status(404).json({ success: false, message: '과제를 찾을 수 없습니다.' });
            }

            const users = db.getData("/users");
            const creator = users.find(u => u.user_id === assignment.creator_id);

            const testCases = db.getData("/test_cases");
            const assignmentTestCases = testCases.filter(tc => tc.assignment_id === assignmentId);

            // 학생은 공개 테스트케이스만, 교수는 모든 테스트케이스
            const filteredTestCases = req.user.role === 'student' ? 
                assignmentTestCases.filter(tc => tc.is_public) : 
                assignmentTestCases;

            const result = {
                ...assignment,
                creator_name: creator ? creator.name : 'Unknown',
                test_cases: filteredTestCases.sort((a, b) => a.case_number - b.case_number)
            };

            // 학생의 경우 제출 현황 추가
            if (req.user.role === 'student') {
                const submissions = db.getData("/assignment_submissions");
                const userSubmission = submissions.find(s => 
                    s.assignment_id === assignmentId && s.user_id === req.user.user_id
                );
                result.user_submission = userSubmission || null;
            }

            res.json({ success: true, assignment: result });
        } catch (error) {
            console.error('Assignment detail error:', error);
            res.status(500).json({ success: false, message: '과제 상세 조회 중 오류가 발생했습니다.' });
        }
    }
);

// 시스템 상태 확인 API
app.get('/api/health', (req, res) => {
    try {
        const users = db.getData("/users");
        res.json({
            success: true,
            status: 'healthy',
            database: 'connected',
            users_count: users.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
});

// ==================== 에러 핸들링 ====================

// 404 처리
app.use((req, res) => {
    res.status(404).json({ success: false, message: '요청한 리소스를 찾을 수 없습니다.' });
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: '잘못된 JSON 형식입니다.' });
    }
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: '파일 크기가 너무 큽니다.' });
    }
    
    res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
});

// 프로세스 종료 처리
process.on('SIGINT', () => {
    console.log('\n서버를 종료합니다...');
    try {
        db.save();
        console.log('✅ 데이터베이스가 저장되었습니다.');
    } catch (error) {
        console.error('❌ 데이터베이스 저장 중 오류:', error);
    }
    process.exit(0);
});

// 데이터베이스 초기화 및 서버 시작
initializeDatabase();

// 서버 시작
app.listen(port, () => {
    console.log(`
🚀 블록코딩 교육 플랫폼 서버가 시작되었습니다! (JSON-DB 버전)
📍 포트: ${port}
🌐 URL: http://localhost:${port}
📊 데이터베이스: JSON 파일 기반 (database.json)
🔐 암호화: bcryptjs
⚡ 특징: 컴파일 불필요, Node.js 22 완전 호환

📚 테스트 계정:
👤 학생: test@afa.ac.kr / password123
👨‍🏫 교수: teacher@afa.ac.kr / password123  
👨‍💼 관리자: admin@afa.ac.kr / password123

🔧 주요 기능:
✅ JSON 파일 기반 데이터베이스 (SQLite 불필요)
✅ 네이티브 모듈 제거 (컴파일 문제 해결)
✅ Node.js 22.14.0 완전 호환
✅ Visual Studio Build Tools 불필요
✅ bcryptjs 사용 (컴파일 불필요)
✅ 정규화된 데이터 구조 유지
✅ JWT 기반 인증 시스템
✅ 블록 코딩 프로젝트 관리
✅ 알고리즘 학습 시스템
✅ 과제 관리 기능
✅ 시스템 로깅 및 통계

📋 주요 API 엔드포인트:
🔐 /api/login, /api/signup
👤 /api/user/profile
🧩 /api/block-types, /api/projects
🔬 /api/algorithm-categories, /api/algorithms
📝 /api/assignments, /api/assignments/:id
📊 /api/admin/statistics
💚 /api/health (상태 확인)

💡 JSON-DB 장점:
- 설치 오류 없음
- 백업 및 이동 용이
- 데이터 직접 확인 가능
- 개발 환경에 최적화
    `);
});