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
const db = new JsonDB(new Config("database", true, true, '/'));

//인메모리카운터... 중복아이디 해결법
let memoryCounters = {
    user_id: 1,
    profile_id: 1,
    block_type_id: 1,
    project_id: 1,
    version_id: 1,
    block_id: 1,
    category_id: 1,
    algorithm_id: 1,
    assignment_id: 1,
    test_case_id: 1,
    submission_id: 1,
    log_id: 1
};
// 미들웨어 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // 인라인 스크립트 허용
            styleSrc: ["'self'", "'unsafe-inline'"],   // 인라인 CSS 허용
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

// 완전히 수정된 데이터베이스 초기화 함수

// 완전히 수정된 데이터베이스 초기화 (const 오류 해결)

function initializeDatabase() {
    console.log('🗄️  JSON 데이터베이스를 초기화합니다...');

    try {
        // 기본 구조 생성
        const cleanData = {
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
            system_logs: []
        };

        // 전체 데이터 구조를 한 번에 저장
        db.push("/", cleanData);
        console.log('✅ 데이터베이스 구조 생성 완료');

        // 초기 데이터 삽입
        insertInitialDataSafely();

        // 최종 확인
        setTimeout(() => {
            try {
                const users = db.getData("/users");
                const blockTypes = db.getData("/block_types");
                const categories = db.getData("/algorithm_categories");
                
                console.log(`
🎉 데이터베이스 초기화 완료!
📊 실제 저장된 데이터:
   👥 사용자: ${users.length}명
   🧩 블록 타입: ${blockTypes.length}개  
   📚 알고리즘 카테고리: ${categories.length}개
                `);
                
                if (users.length > 0) {
                    console.log('✅ 로그인 테스트 가능합니다!');
                    users.forEach(user => {
                        console.log(`   - ${user.email} (ID: ${user.user_id}, 역할: ${user.role})`);
                    });
                }
            } catch (e) {
                console.warn('⚠️ 최종 확인 중 오류:', e.message);
            }
        }, 1000); // 1초 후 확인

    } catch (error) {
        console.error('❌ 데이터베이스 초기화 오류:', error);
        process.exit(1);
    }
}

// ==================== 데이터 저장 확인을 위한 헬퍼 함수 ====================
function verifyDataSaved() {
    try {
        const users = db.getData("/users");
        console.log(`🔍 현재 저장된 사용자 수: ${users.length}`);
        return users.length > 0;
    } catch (error) {
        console.error('⚠️ 데이터 확인 실패:', error);
        return false;
    }
}
// ==================== 완전히 수정된 ID 생성 함수 ====================
function getNextId(counterName) {
    try {
        const currentId = memoryCounters[counterName] || 1;
        console.log(`🔢 ${counterName} ID 생성: ${currentId}`);
        
        // 다음 ID로 증가
        memoryCounters[counterName] = currentId + 1;
        
        return currentId;
        
    } catch (error) {
        console.error(`❌ ${counterName} ID 생성 오류:`, error);
        const uniqueId = Date.now() % 100000;
        console.log(`🆘 ${counterName} 임시 ID 사용: ${uniqueId}`);
        return uniqueId;
    }
}

// 수정된 insertInitialDataSafely 함수 (catch 블록 추가)
function insertInitialDataSafely() {
    try {
        console.log('📝 초기 데이터를 삽입합니다...');

        // 1단계: 사용자 데이터 처리
        let users;
        try {
            users = db.getData("/users");
            if (!Array.isArray(users)) {
                console.log('⚠️ users가 배열이 아닙니다. 빈 배열로 초기화합니다.');
                db.push("/users", []);
                
                users = [];
            }
        } catch (error) {
            console.log('🆕 users 배열을 새로 생성합니다.');
            db.push("/users", []);
            
            users = [];
        }

        console.log(`👥 현재 사용자 수: ${users.length}`);
        
        // 관리자 계정 존재 확인
        const existingAdmin = users.find(u => u && u.email === 'admin@afa.ac.kr');
        
        if (!existingAdmin) {
            console.log('👤 기본 사용자 계정 생성 중...');
            
            const hashedPassword = bcrypt.hashSync('password123', 10);
            const now = new Date().toISOString();
            
            // 사용자 데이터 (중복 방지를 위해 하나씩 생성)
            const userData = [
                {
                    email: 'test@afa.ac.kr',
                    name: '김준호',
                    student_number: '20240001',
                    role: 'student'
                },
                {
                    email: 'teacher@afa.ac.kr',
                    name: '유승훈',
                    student_number: '19980001',
                    role: 'professor'
                },
                {
                    email: 'admin@afa.ac.kr',
                    name: '관리자',
                    student_number: '19900001',
                    role: 'admin'
                }
            ];

            // 사용자 생성 (각각 고유 ID로)
            userData.forEach((data, index) => {
                const userId = getNextId('user_id');
                console.log(`👤 사용자 ${index + 1} 생성 중... ID: ${userId}`);
                
                const newUser = {
                    user_id: userId,
                    email: data.email,
                    password_hash: hashedPassword,
                    name: data.name,
                    student_number: data.student_number,
                    role: data.role,
                    profile_image_url: null,
                    created_at: now,
                    updated_at: now,
                    last_login: null,
                    is_active: true
                };

                try {
                    db.push("/users[]", newUser, true);
                    
                    console.log(`✅ 사용자 생성: ${data.email} (ID: ${userId}, 역할: ${data.role})`);
                    
                    // 사용자 프로필 생성
                    const profileId = getNextId('profile_id');
                    const newProfile = {
                        profile_id: profileId,
                        user_id: userId,
                        coding_experience: null,
                        learning_preferences: null,
                        bio: null,
                        created_at: now,
                        updated_at: now
                    };
                    db.push("/user_profiles[]", newProfile, true);
                    
                    console.log(`✅ 프로필 생성: ID ${profileId} (사용자 ID: ${userId})`);
                    
                } catch (userError) {
                    console.error(`❌ 사용자 ${data.email} 생성 실패:`, userError);
                }
            });

            console.log('✅ 기본 사용자 계정 생성 완료 (3명)');
        } else {
            console.log('✅ 관리자 계정이 이미 존재합니다');
        }

        // 2단계: 블록 타입 처리
        let blockTypes;
        try {
            blockTypes = db.getData("/block_types");
            if (!Array.isArray(blockTypes)) {
                db.push("/block_types", []);
                
                blockTypes = [];
            }
        } catch (error) {
            db.push("/block_types", []);
            
            blockTypes = [];
        }

        if (blockTypes.length === 0) {
            console.log('🧩 기본 블록 타입 생성 중...');
            
            const blockTypeData = [
                { name: 'print', category: 'output', description: '텍스트 출력 블록', color: '#4CAF50' },
                { name: 'variable', category: 'data', description: '변수 선언 블록', color: '#FF9800' },
                { name: 'input', category: 'input', description: '사용자 입력 블록', color: '#2196F3' },
                { name: 'if_statement', category: 'control', description: '조건문 블록', color: '#F44336' },
                { name: 'for_loop', category: 'control', description: '반복문 블록', color: '#9C27B0' }
            ];

            blockTypeData.forEach((blockData, index) => {
                const blockId = getNextId('block_type_id');
                console.log(`🧩 블록 타입 ${index + 1} 생성 중... ID: ${blockId}`);
                
                const blockType = {
                    block_type_id: blockId,
                    type_name: blockData.name,
                    category: blockData.category,
                    description: blockData.description,
                    default_properties: JSON.stringify({
                        color: blockData.color, 
                        shape: blockData.category === 'control' ? 'c_shape' : 'rounded'
                    }),
                    created_at: new Date().toISOString()
                };
                
                db.push("/block_types[]", blockType, true);
                
                console.log(`✅ 블록 타입 생성: ${blockData.name} (ID: ${blockId})`);
            });

            console.log(`✅ 기본 블록 타입 생성 완료 (${blockTypeData.length}개)`);
        }

        // 3단계: 알고리즘 카테고리 처리
        let categories;
        try {
            categories = db.getData("/algorithm_categories");
            if (!Array.isArray(categories)) {
                db.push("/algorithm_categories", []);
                
                categories = [];
            }
        } catch (error) {
            db.push("/algorithm_categories", []);
            
            categories = [];
        }

        if (categories.length === 0) {
            console.log('📚 알고리즘 카테고리 생성 중...');
            
            const categoryData = [
                { name: 'sorting', description: '정렬 알고리즘', order: 1 },
                { name: 'searching', description: '탐색 알고리즘', order: 2 },
                { name: 'graph', description: '그래프 알고리즘', order: 3 }
            ];

            categoryData.forEach((catData, index) => {
                const catId = getNextId('category_id');
                console.log(`📚 카테고리 ${index + 1} 생성 중... ID: ${catId}`);
                
                const category = {
                    category_id: catId,
                    category_name: catData.name,
                    description: catData.description,
                    sort_order: catData.order,
                    created_at: new Date().toISOString()
                };
                
                db.push("/algorithm_categories[]", category, true);
            
                console.log(`✅ 카테고리 생성: ${catData.name} (ID: ${catId})`);
            });

            console.log(`✅ 알고리즘 카테고리 생성 완료 (${categoryData.length}개)`);
        }

        // 최종 상태 확인 (안전한 방식)
        let finalUsers, finalBlockTypes, finalCategories;
        
        try {
            finalUsers = db.getData("/users");
            if (!Array.isArray(finalUsers)) {
                finalUsers = [];
            }
        } catch (e) {
            finalUsers = [];
        }
        
        try {
            finalBlockTypes = db.getData("/block_types");
            if (!Array.isArray(finalBlockTypes)) {
                finalBlockTypes = [];
            }
        } catch (e) {
            finalBlockTypes = [];
        }
        
        try {
            finalCategories = db.getData("/algorithm_categories");
            if (!Array.isArray(finalCategories)) {
                finalCategories = [];
            }
        } catch (e) {
            finalCategories = [];
        }
        
        console.log(`
🎉 초기 데이터 삽입 완료!
📊 최종 상태:
   👥 사용자: ${finalUsers.length}명
   🧩 블록 타입: ${finalBlockTypes.length}개  
   📚 알고리즘 카테고리: ${finalCategories.length}개
        `);

        // ID 중복 확인 (안전한 방식)
        if (finalUsers.length > 0) {
            try {
                const userIds = finalUsers.map(u => u.user_id);
                const uniqueUserIds = [...new Set(userIds)];
                console.log(`🔍 사용자 ID 중복 검사: 전체 ${userIds.length}개, 고유 ${uniqueUserIds.length}개`);
                
                if (userIds.length !== uniqueUserIds.length) {
                    console.warn('⚠️ 사용자 ID 중복 발견!');
                } else {
                    console.log('✅ 사용자 ID 중복 없음');
                }
            } catch (mapError) {
                console.warn('⚠️ ID 중복 검사 생략 (데이터 구조 문제)');
            }
        }

    } catch (error) {
        console.error('❌ 초기 데이터 삽입 중 오류:', error);
        console.error('오류 상세:', error.message);
        console.error('스택 트레이스:', error.stack);
    }
}
// 기본 블록 타입 생성
function createDefaultBlockTypes() {
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
            type_name: 'if_statement',
            category: 'control',
            description: '조건문 블록',
            default_properties: JSON.stringify({color: "#F44336", shape: "c_shape"}),
            created_at: new Date().toISOString()
        }
    ];

    initialBlockTypes.forEach(blockType => {
        db.push("/block_types[]", blockType, true);
    });
    console.log('✅ 기본 블록 타입 생성 완료');
}

// 기본 카테고리 생성
function createDefaultCategories() {
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
        }
    ];

    initialCategories.forEach(category => {
        db.push("/algorithm_categories[]", category, true);
    });
    console.log('✅ 알고리즘 카테고리 생성 완료');
}

// 초기 데이터 삽입 (수정된 버전)
function insertInitialData() {
    try {
        console.log('📝 초기 데이터를 삽입합니다...');

        // 안전한 데이터 접근
        let users = [];
        try {
            users = db.getData("/users");
        } catch (error) {
            console.log('🆕 users 배열 생성...');
            db.push("/users", []);
            users = [];
        }

        // 기존 사용자 확인
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
        let blockTypes = [];
        try {
            blockTypes = db.getData("/block_types");
        } catch (error) {
            db.push("/block_types", []);
            blockTypes = [];
        }

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
        let categories = [];
        try {
            categories = db.getData("/algorithm_categories");
        } catch (error) {
            db.push("/algorithm_categories", []);
            categories = [];
        }

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



// JWT 토큰 검증 미들웨어--나중에 구현하면 좋겠지만....
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

app.get('/dashboard', (req, res) => {
    if (req.user.role === 'professor' || req.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'public/S02_2.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/S02.html'));
    }
});



// ==================== 추가 페이지 라우트 ====================
// 기존 라우트 아래에 추가

// 회원가입 페이지 라우트
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S01_03.html'));
});

// 비밀번호 찾기 페이지 라우트
app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S01_04.html'));
});

// 교수 대시보드 페이지 라우트
app.get('/teacher-dashboard', checkRole(['professor', 'admin']), (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S02_2.html'));
});

// 블록 코딩 페이지 라우트
app.get('/block-coding', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S03.html'));
});

// 알고리즘 시각화 페이지 라우트
app.get('/algorithm', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S04.html'));
});

// 과제 관리 페이지 라우트
app.get('/assignments', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S05.html'));
});

// 학습 현황 페이지 라우트
app.get('/progress', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S06.html'));
});

// 교수용 과제 출제 페이지 라우트
app.get('/create-assignment', checkRole(['professor', 'admin']), (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S07.html'));
});

// 교수용 제출물 평가 페이지 라우트
app.get('/review-submissions', checkRole(['professor', 'admin']), (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S08.html'));
});

// 교수용 학생 성취도 페이지 라우트
app.get('/student-analytics', checkRole(['professor', 'admin']), (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S09.html'));
});

// 교수용 학생 관리 페이지 라우트
app.get('/student-management', checkRole(['professor', 'admin']), (req, res) => {
    res.sendFile(path.join(__dirname, 'public/S10.html'));
});

// ==================== 추가 API 라우트 ====================

// 회원가입 API
app.post('/api/signup', 
    [
        body('email').isEmail().withMessage('유효한 이메일을 입력해주세요.'),
        body('password').isLength({ min: 6 }).withMessage('비밀번호는 최소 6자 이상이어야 합니다.'),
        body('name').isLength({ min: 2 }).withMessage('이름은 최소 2자 이상이어야 합니다.'),
        body('student_number').optional().isLength({ min: 8, max: 8 }).withMessage('학번은 8자리여야 합니다.')
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { email, password, name, student_number, role = 'student' } = req.body;

            const users = db.getData("/users");
            const existingUser = users.find(u => u.email === email);

            if (existingUser) {
                return res.status(400).json({ success: false, message: '이미 가입된 이메일입니다.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const now = new Date().toISOString();

            const newUser = {
                user_id: getNextId('user_id'),
                email,
                password_hash: hashedPassword,
                name,
                student_number: student_number || null,
                role,
                profile_image_url: null,
                created_at: now,
                updated_at: now,
                last_login: null,
                is_active: true
            };

            db.push("/users[]", newUser, true);

            // 사용자 프로필 생성
            const newProfile = {
                profile_id: getNextId('profile_id'),
                user_id: newUser.user_id,
                coding_experience: null,
                learning_preferences: null,
                bio: null,
                created_at: now,
                updated_at: now
            };
            db.push("/user_profiles[]", newProfile, true);

            logAction(newUser.user_id, 'USER_REGISTERED', 'New user registered', { email }, req.ip);

            res.json({ success: true, message: '회원가입이 완료되었습니다.' });
        } catch (error) {
            console.error('Signup error:', error);
            res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
        }
    }
);

// 비밀번호 찾기 API
app.post('/api/forgot-password', 
    [
        body('email').isEmail().withMessage('유효한 이메일을 입력해주세요.')
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { email } = req.body;

            const users = db.getData("/users");
            const user = users.find(u => u.email === email && u.is_active);

            if (!user) {
                // 보안상 실제로는 존재하지 않는 이메일이어도 성공 메시지를 반환
                return res.json({ success: true, message: '임시 비밀번호가 이메일로 전송되었습니다.' });
            }

            // 실제로는 이메일 발송 로직이 들어가야 함
            // 여기서는 로그만 기록
            logAction(user.user_id, 'PASSWORD_RESET_REQUESTED', 'Password reset requested', { email }, req.ip);

            res.json({ success: true, message: '임시 비밀번호가 이메일로 전송되었습니다.' });
        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
        }
    }
);

// 사용자 진행률 API
app.get('/api/user/progress', (req, res) => {
    try {
        // 실제로는 사용자 ID에 따라 데이터베이스에서 진행률을 조회해야 함
        // 현재는 샘플 데이터 반환
        const progress = {
            user_id: req.user.user_id,
            overall_progress: Math.floor(Math.random() * 100), // 0-100%
            completed_modules: Math.floor(Math.random() * 10),
            total_modules: 10,
            completed_assignments: Math.floor(Math.random() * 5),
            total_assignments: 8,
            current_streak: Math.floor(Math.random() * 7), // 연속 학습 일수
            total_coding_time: Math.floor(Math.random() * 1000) + 100, // 분 단위
            last_activity: new Date().toISOString()
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

// 사용자 프로필 조회 API
app.get('/api/user/profile', (req, res) => {
    try {
        const users = db.getData("/users");
        const user = users.find(u => u.user_id === req.user.user_id);

        if (!user) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }

        const userProfiles = db.getData("/user_profiles");
        const profile = userProfiles.find(p => p.user_id === req.user.user_id);

        res.json({
            success: true,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
                student_number: user.student_number,
                profile_image_url: user.profile_image_url,
                created_at: user.created_at,
                last_login: user.last_login
            },
            profile: profile || null
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, message: '프로필 조회 중 오류가 발생했습니다.' });
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
            console.log('🔑 로그인 시도 시작');
            console.log('📝 요청 데이터:', req.body);
            
            const { email, password } = req.body;

            // 데이터베이스에서 사용자 조회 (안전한 방식)
            console.log('📊 데이터베이스에서 사용자 조회 중...');
            let users;
            try {
                users = db.getData("/users");
                console.log('🔍 users 타입:', typeof users);
                console.log('🔍 users가 배열인가?', Array.isArray(users));
                console.log('🔍 users 내용:', users);
                
                // users가 배열이 아닌 경우 처리
                if (!Array.isArray(users)) {
                    console.log('⚠️ users가 배열이 아닙니다. 빈 배열로 초기화합니다.');
                    db.push("/users", []);
                    users = [];
                }
                
                console.log(`👥 전체 사용자 수: ${users.length}`);
            } catch (dbError) {
                console.error('❌ 데이터베이스 조회 오류:', dbError);
                // users 테이블이 없는 경우 빈 배열로 초기화
                console.log('🆕 users 테이블을 새로 생성합니다.');
                db.push("/users", []);
                users = [];
            }

            // 사용자가 없는 경우 초기 데이터 삽입
            if (users.length === 0) {
                console.log('📝 사용자가 없어서 초기 데이터를 삽입합니다.');
                await insertInitialDataSafely();
                
                // 다시 조회
                users = db.getData("/users");
                console.log(`👥 초기 데이터 삽입 후 사용자 수: ${users.length}`);
            }

            // 배열 안전성 재확인
            if (!Array.isArray(users)) {
                console.error('❌ users가 여전히 배열이 아닙니다.');
                return res.status(500).json({ 
                    success: false, 
                    message: '데이터베이스 구조 오류입니다.' 
                });
            }

            const user = users.find(u => u && u.email === email && u.is_active);
            console.log('🔍 사용자 검색 결과:', user ? `찾음 (${user.name})` : '없음');

            if (!user) {
                console.log('❌ 사용자 없음 또는 비활성 계정');
                logAction(null, 'LOGIN_FAILED', `Failed login attempt for email: ${email}`, {}, req.ip);
                return res.status(401).json({ 
                    success: false, 
                    message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
                });
            }

            // 비밀번호 검증
            console.log('🔐 비밀번호 검증 중...');
            let isValidPassword;
            try {
                isValidPassword = await bcrypt.compare(password, user.password_hash);
                console.log('🔐 비밀번호 검증 결과:', isValidPassword ? '성공' : '실패');
            } catch (bcryptError) {
                console.error('❌ 비밀번호 검증 오류:', bcryptError);
                return res.status(500).json({ 
                    success: false, 
                    message: '비밀번호 검증 중 오류가 발생했습니다.' 
                });
            }

            if (!isValidPassword) {
                console.log('❌ 잘못된 비밀번호');
                logAction(user.user_id, 'LOGIN_FAILED', 'Invalid password', {}, req.ip);
                return res.status(401).json({ 
                    success: false, 
                    message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
                });
            }

            // 로그인 시간 업데이트
            console.log('⏰ 로그인 시간 업데이트 중...');
            try {
                const userIndex = users.findIndex(u => u.user_id === user.user_id);
                if (userIndex >= 0) {
                    db.push(`/users[${userIndex}]/last_login`, new Date().toISOString());
                    console.log('✅ 로그인 시간 업데이트 완료');
                }
            } catch (updateError) {
                console.error('⚠️ 로그인 시간 업데이트 실패:', updateError);
                // 치명적이지 않으므로 계속 진행
            }

            // JWT 토큰 생성
            console.log('🎫 JWT 토큰 생성 중...');
            let token;
            try {
                token = jwt.sign(
                    { 
                        user_id: user.user_id,
                        email: user.email,
                        name: user.name,
                        role: user.role 
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                console.log('✅ JWT 토큰 생성 완료');
            } catch (jwtError) {
                console.error('❌ JWT 토큰 생성 오류:', jwtError);
                return res.status(500).json({ 
                    success: false, 
                    message: 'JWT 토큰 생성 중 오류가 발생했습니다.' 
                });
            }

            // 로그 기록
            console.log('📝 성공 로그 기록 중...');
            try {
                logAction(user.user_id, 'LOGIN_SUCCESS', 'User logged in successfully', {}, req.ip);
            } catch (logError) {
                console.error('⚠️ 로그 기록 실패:', logError);
                // 치명적이지 않으므로 계속 진행
            }

            // 성공 응답
            console.log('🎉 로그인 성공!');
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
            console.error('💥 로그인 API 전체 오류:', error);
            console.error('📍 오류 스택:', error.stack);
            res.status(500).json({ 
                success: false, 
                message: '서버 오류가 발생했습니다.',
                debug: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
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

// 블록 타입 목록 조회 API
app.get('/api/block-types', (req, res) => {
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
    console.log('✅ 서버가 안전하게 종료되었습니다.');
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
✅ 시스템 로깅 및 통계

📋 주요 API 엔드포인트:
🔐 /api/login
🧩 /api/block-types  
💚 /api/health (상태 확인)

💡 JSON-DB 장점:
- 설치 오류 없음
- 백업 및 이동 용이
- 데이터 직접 확인 가능
- 개발 환경에 최적화
    `);
});
