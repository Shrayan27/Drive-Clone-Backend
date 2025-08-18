# Drive Clone Backend

A robust backend API for a Google Drive clone built with Node.js, Express, TypeScript, PostgreSQL, and Firebase Storage.

## 🚀 Features

- **Authentication System**: JWT-based auth with Google OAuth integration
- **File Management**: Upload, download, organize, and manage files
- **Folder Structure**: Hierarchical folder organization with breadcrumbs
- **File Storage**: Firebase Storage integration with thumbnail generation
- **Sharing & Permissions**: File sharing via links and email
- **Search & Optimization**: Full-text search with pagination
- **Trash System**: Soft delete with restore functionality
- **Version Control**: File versioning support
- **Security**: Rate limiting, CORS, and input validation

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with connection pooling
- **Storage**: Firebase Storage
- **Authentication**: JWT + Google OAuth
- **File Processing**: Multer + Sharp for image thumbnails
- **Security**: Helmet, CORS, Rate Limiting
- **Testing**: Jest + Supertest

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Firebase project with Storage enabled
- Google OAuth credentials

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the environment file and configure your variables:

```bash
cp env.example .env
```

Fill in your configuration:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/drive_clone
DB_HOST=localhost
DB_PORT=5432
DB_NAME=drive_clone
DB_USER=username
DB_PASSWORD=password

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account-email
```

### 3. Database Setup

Create the database and run the schema:

```bash
# Create database
createdb drive_clone

# Run schema
psql -d drive_clone -f src/database/schema.sql
```

### 4. Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/auth/signup`

Create a new user account.

**Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### POST `/api/auth/login`

Authenticate user and get JWT token.

**Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### POST `/api/auth/google`

Authenticate with Google OAuth.

**Body:**

```json
{
  "idToken": "google-id-token"
}
```

#### GET `/api/auth/profile`

Get authenticated user profile.

**Headers:**

```
Authorization: Bearer <jwt-token>
```

### File Management Endpoints

#### POST `/api/files/upload`

Upload a new file.

**Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Body:**

```
file: <file>
folderId: "optional-folder-id"
name: "optional-custom-name"
```

#### GET `/api/files`

Get user files with pagination and search.

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**

- `folderId`: Filter by folder
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search query
- `sortBy`: Sort field (name, size, created_at, updated_at)
- `sortOrder`: Sort direction (asc, desc)

#### DELETE `/api/files/:fileId`

Soft delete a file (move to trash).

#### POST `/api/files/:fileId/restore`

Restore a file from trash.

#### GET `/api/files/trash`

Get deleted files.

### Folder Management Endpoints

#### POST `/api/folders`

Create a new folder.

**Body:**

```json
{
  "name": "New Folder",
  "parentId": "optional-parent-folder-id"
}
```

#### GET `/api/folders`

Get folders with optional file inclusion.

**Query Parameters:**

- `parentId`: Parent folder ID
- `includeFiles`: Include files in response (true/false)

#### GET `/api/folders/hierarchy`

Get complete folder hierarchy tree.

#### PUT `/api/folders/:folderId`

Update folder name.

#### DELETE `/api/folders/:folderId`

Delete folder and all contents.

#### GET `/api/folders/:folderId/breadcrumbs`

Get navigation breadcrumbs for a folder.

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 📁 Project Structure

```
src/
├── config/          # Configuration files
│   └── firebase.ts  # Firebase setup
├── controllers/     # Route controllers
│   ├── authController.ts
│   ├── fileController.ts
│   └── folderController.ts
├── database/        # Database related
│   ├── connection.ts # Database connection
│   └── schema.sql   # Database schema
├── middleware/      # Custom middleware
│   └── auth.ts      # Authentication middleware
├── routes/          # API routes
│   ├── auth.ts      # Authentication routes
│   ├── files.ts     # File management routes
│   └── folders.ts   # Folder management routes
└── index.ts         # Main server file
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent abuse with configurable limits
- **Input Validation**: Sanitize and validate all inputs
- **CORS Protection**: Configured for production security
- **Helmet**: Security headers and protection
- **SQL Injection Prevention**: Parameterized queries

## 🚀 Deployment

### Environment Variables

Ensure all environment variables are set in production.

### Database

- Use a managed PostgreSQL service (AWS RDS, Google Cloud SQL)
- Configure connection pooling for production load
- Set up automated backups

### Firebase

- Configure Firebase project for production
- Set up proper security rules
- Monitor storage usage and costs

### Server

- Use PM2 or similar process manager
- Set up reverse proxy (Nginx)
- Configure SSL certificates
- Set up monitoring and logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:

- Check the documentation
- Review existing issues
- Create a new issue with detailed information
