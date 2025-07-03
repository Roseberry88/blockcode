# 🚀 Node.js 호환성 문제 완전 해결 방법

echo "🔧 Node.js 호환성 문제를 해결합니다..."

# 1. 모든 파일 완전 정리
echo "🗑️  모든 파일을 정리합니다..."
taskkill /f /im node.exe 2>/dev/null || true
rm -rf node_modules
rm -f package-lock.json

# 2. 네이티브 모듈 없는 package.json 생성
echo "📦 네이티브 모듈 없는 package.json 생성..."
cat > package.json << 'EOF'
{
  "name": "blockcode-backend",
  "version": "1.0.0",
  "description": "블록코딩 교육 플랫폼 백엔드",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "node-json-db": "^2.3.0",
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
    "nodemon": "^3.0.2"
  }
}
EOF

echo "✅ 네이티브 모듈 제거됨:"
echo "  - better-sqlite3 → node-json-db (JSON 파일 기반)"
echo "  - sqlite3 제거"
echo "  - 모든 컴파일 필요 모듈 제거"

# 3. 캐시 정리
echo "🧹 npm 캐시 정리..."
npm cache clean --force

# 4. 한 번에 모든 패키지 설치
echo "📦 모든 패키지를 한 번에 설치합니다..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ 패키지 설치 성공!"
else
    echo "❌ 패키지 설치 실패"
    exit 1
fi

echo ""
echo "🎉 설치 완료!"
echo "📝 변경사항:"
echo "  ✅ SQLite → JSON 파일 데이터베이스"
echo "  ✅ 컴파일 없는 순수 JavaScript 모듈만 사용"
echo "  ✅ Node.js 22 완전 호환"
echo "  ✅ Visual Studio Build Tools 불필요"
echo ""
echo "📂 다음 단계:"
echo "1. server.js 파일을 JSON-DB 버전으로 교체"
echo "2. 서버 실행"