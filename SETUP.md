# 环境配置和启动指南

## ✅ 已完成的配置

1. ✅ 已创建后端 `.env` 文件 (`backend/api/.env`)
2. ✅ 已创建前端 `.env.local` 文件 (`frontend/.env.local`)

## 📋 需要手动执行的步骤

由于权限限制，以下步骤需要您手动执行：

### 1. 启动数据库服务

在项目根目录执行：

```bash
docker-compose up -d
```

这将启动 PostgreSQL 数据库服务。等待服务完全启动（约 10-30 秒）。

### 2. 运行数据库迁移

进入后端目录并运行 Prisma 迁移：

```bash
cd backend/api
npx prisma migrate deploy
```

或者如果是首次设置：

```bash
npx prisma migrate dev
```

### 3. 生成 Prisma Client

```bash
npx prisma generate
```

### 4. 启动后端服务

```bash
cd backend/api
npm run start:dev
```

后端服务将在 `http://localhost:3001` 启动。

### 5. 启动前端服务

在新的终端窗口中：

```bash
cd frontend
npm run dev
```

前端服务将在 `http://localhost:3000` 启动。

## 🔍 验证配置

### 检查环境变量

**后端** (`backend/api/.env`):
- ✅ `DATABASE_URL` - 数据库连接字符串
- ✅ `PORT` - 后端服务端口 (默认: 3001)
- ✅ `NODE_ENV` - 环境模式 (development)
- ✅ `AI_API_KEY` - AI 服务 API Key
- ✅ `AI_BASE_URL` - AI 服务基础 URL
- ✅ `AI_MODEL` - AI 模型名称

**前端** (`frontend/.env.local`):
- ✅ `NEXT_PUBLIC_API_URL` - 后端 API 地址 (默认: http://localhost:3001/api)

### 检查数据库连接

如果遇到数据库连接问题，请确认：

1. Docker 容器正在运行：
   ```bash
   docker ps
   ```
   应该看到 `nexusmind-postgres` 容器在运行。

2. 数据库连接字符串正确：
   - 用户名: `nexusmind`
   - 密码: `nexusmind_secret`
   - 数据库名: `nexusmind_db`
   - 端口: `5432`

3. 数据库迁移已执行：
   ```bash
   cd backend/api
   npx prisma migrate status
   ```

## 🐛 常见问题排查

### 问题：前端一直加载，没有响应

**可能原因：**
1. 后端服务未启动
2. 数据库未连接
3. AI API 配置错误或 API Key 无效
4. 网络连接问题

**解决方案：**
1. 检查后端服务是否在运行：访问 `http://localhost:3001/api` 应该返回响应
2. 检查后端日志中的错误信息
3. 验证 AI API Key 是否有效
4. 检查数据库连接是否正常

### 问题：数据库连接失败

**可能原因：**
1. Docker 容器未启动
2. 端口被占用
3. 环境变量配置错误

**解决方案：**
1. 启动 Docker 服务：`docker-compose up -d`
2. 检查端口占用：`netstat -ano | findstr :5432`
3. 验证 `.env` 文件中的 `DATABASE_URL` 配置

### 问题：Prisma 迁移失败

**可能原因：**
1. 数据库未启动
2. 连接字符串错误
3. 权限问题

**解决方案：**
1. 确保数据库服务正在运行
2. 检查 `DATABASE_URL` 配置
3. 尝试重置数据库（仅开发环境）：
   ```bash
   npx prisma migrate reset
   ```

## 📝 环境变量说明

### 后端环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 数据库连接字符串 | `postgresql://nexusmind:nexusmind_secret@localhost:5432/nexusmind_db` |
| `PORT` | 后端服务端口 | `3001` |
| `NODE_ENV` | 运行环境 | `development` |
| `AI_API_KEY` | AI 服务 API Key | 需要配置 |
| `AI_BASE_URL` | AI 服务基础 URL | `https://api.deepseek.com/v1` |
| `AI_MODEL` | AI 模型名称 | `deepseek-chat` |

### 前端环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | `http://localhost:3001/api` |

## 🚀 快速启动命令

```bash
# 1. 启动数据库
docker-compose up -d

# 2. 后端 - 运行迁移和启动
cd backend/api
npx prisma migrate deploy
npx prisma generate
npm run start:dev

# 3. 前端 - 新终端窗口
cd frontend
npm run dev
```

## 📞 需要帮助？

如果遇到问题，请检查：
1. 后端服务日志
2. 前端浏览器控制台
3. Docker 容器日志：`docker-compose logs`
4. 数据库连接状态
