# 📋 블록코딩 플랫폼 백엔드 마이그레이션 가이드

# =============================================================================
# 1단계: 기존 파일 백업 및 정리
# =============================================================================

# 현재 위치 확인 (D:\blockcode\blockcode 디렉토리에 있어야 함)
pwd

# 기존 server.js 백업
echo "기존 server.js를 백업합니다..."
if [ -f server.js ]; then
    mv server.js server_old.js
    echo "✅ server.js → server_old.js로 백업 완료"
else
    echo "⚠️  server.js가 없습니다. 새로 생성합니다."
fi

# scripts 디렉토리 생성
echo "scripts 디렉토리를 생성합니다..."
mkdir -p scripts
echo "✅ scripts 디렉토리 생성 완료"

# uploads 디렉토리 생성
echo "uploads 디렉토리를 생성합니다..."
mkdir -p uploads
echo "✅ uploads 디렉토리 생성 완료"

# =============================================================================
# 2단계: 새 파일들 생성
# =============================================================================

echo "🔧 새로운 파일들을 생성하고 있습니다..."

# .env 파일 생성
echo "📝 .env 파일을 생성합니다..."
cat > .env << 'EOF'
# 서버 설정
NODE_ENV=development
PORT=3000

# JWT 보안 설정
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-2024-blockcode-platform

# 데이터베이스 설정
DATABASE_PATH=./database.db

# 파일 업로드 설정
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# CORS 설정
CORS_ORIGIN=http://localhost:3000

# Rate Limiting 설정
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5

# 보안 설정
BCRYPT_ROUNDS=12
SESSION_TIMEOUT_HOURS=24
EOF
echo "✅ .env 파일 생성 완료"

# package.json 백업 및 업데이트
echo "📦 package.json을 업데이트합니다..."
if [ -f package.json ]; then
    cp package.json package_old.json
    echo "✅ 기존 package.json 백업 완료"
fi

cat > package.json << 'EOF'
{
  "name": "blockcode-backend",
  "version": "1.0.0",
  "description": "블록코딩 교육 플랫폼 백엔드",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "init-db": "node scripts/initDatabase.js",
    "reset-db": "node scripts/initDatabase.js --reset",
    "sample-data": "node scripts/initDatabase.js --reset --sample-data",
    "test": "jest"
  },
  "keywords": [
    "education",
    "block-coding",
    "nodejs",
    "express",
    "sqlite"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "express-validator": "^7.0.1",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.3.1",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF
echo "✅ package.json 업데이트 완료"

# =============================================================================
# 3단계: 의존성 설치
# =============================================================================

echo "📦 새로운 의존성들을 설치합니다..."
echo "⏳ 이 과정은 몇 분 정도 소요될 수 있습니다..."

# 기존 node_modules와 package-lock.json 제거 (깨끗한 설치를 위해)
if [ -d node_modules ]; then
    echo "🗑️  기존 node_modules 제거 중..."
    rm -rf node_modules
fi

if [ -f package-lock.json ]; then
    echo "🗑️  기존 package-lock.json 제거 중..."
    rm -f package-lock.json
fi

# 새로운 의존성 설치
npm install

if [ $? -eq 0 ]; then
    echo "✅ 의존성 설치 완료!"
else
    echo "❌ 의존성 설치 실패. npm install을 수동으로 실행해주세요."
    exit 1
fi

echo ""
echo "🎉 마이그레이션 준비가 완료되었습니다!"
echo ""
echo "📝 다음 단계:"
echo "1. server.js 파일을 새로운 내용으로 교체"
echo "2. scripts/initDatabase.js 파일 생성"
echo "3. 데이터베이스 초기화 실행"
echo "4. 서버 테스트"
echo ""
echo "📂 파일 구조:"
ls -la
echo ""
echo "🔧 다음 명령어로 계속 진행하세요:"
echo "   npm run init-db --reset --sample-data"
echo "   npm start"