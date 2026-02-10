# Project Development Principles & Guide

> Universal guidelines for AI-assisted software development
> Version: 1.0
> Last Updated: 2025-12-24

---

## 0. Core Philosophy

> "Code quality = AI performance"

The better your code is organized, the better AI can understand and work with it.

---

## 1. Quality Principles

### 1.1 Code Quality

| Principle | Description |
|-----------|-------------|
| **Linting is mandatory** | Use linters/formatters (Black, ESLint, Prettier) |
| **Consistency over creativity** | Follow established patterns |
| **Daily tidying** | Small cleanups every day |
| **Focus on recent code** | Don't hesitate to refactor legacy |

### 1.2 Testing (TDD)

```
Red Phase    → Write test first (fails)
Green Phase  → Write minimum code to pass
Refactor     → Improve code quality
```

- Tests = Context for AI
- Target 90% coverage
- No commit without tests

### 1.3 Documentation

- Keep docs close to code
- Update docs when code changes
- Use clear naming (self-documenting code)

---

## 2. Architecture Principles

### 2.1 Clean Architecture

```
┌─────────────────────────────────────┐
│         Presentation Layer          │  ← API endpoints, UI
├─────────────────────────────────────┤
│         Application Layer           │  ← Use cases, business logic
├─────────────────────────────────────┤
│           Domain Layer              │  ← Entities, core rules (PURE)
├─────────────────────────────────────┤
│        Infrastructure Layer         │  ← DB, external APIs, files
└─────────────────────────────────────┘
```

**Dependency Rule:** Dependencies point INWARD only
- Presentation → Application → Domain ← Infrastructure
- Domain layer has NO external dependencies

### 2.2 Layer Responsibilities

| Layer | Contains | Does NOT Contain |
|-------|----------|------------------|
| **Domain** | Entities, Value Objects, Business Rules | DB queries, API calls, Framework code |
| **Application** | Use Cases, Interfaces (Ports) | UI logic, Direct DB access |
| **Infrastructure** | Repositories, External Services | Business logic |
| **Presentation** | Controllers, Views, DTOs | Business logic, Direct DB access |

### 2.3 Benefits

- AI can focus on one layer at a time
- Easy to test each layer independently
- Easy to swap implementations (e.g., change DB)

---

## 3. Constitution (Constraints)

> "Define what NOT to do first"

### 3.1 Architecture Constraints

**✅ DO:**
- Separate layers clearly
- Use dependency injection
- Define interfaces between layers

**❌ DON'T:**
- Import infrastructure in domain layer
- Put business logic in presentation layer
- Skip layers (presentation → infrastructure directly)

### 3.2 Code Quality Constraints

**✅ DO:**
- Add type hints to all functions
- Write tests before implementation
- Keep functions small (<20 lines ideal)

**❌ DON'T:**
- Use `any` type (TypeScript) or skip types
- Commit without tests
- Ignore linter errors
- Hardcode values (use config)

### 3.3 Security Constraints

**✅ DO:**
- Store secrets in .env files
- Use environment variables
- Encrypt sensitive data

**❌ DON'T:**
- Commit .env files
- Expose API keys to client
- Write raw SQL (use ORM/parameterized queries)

### 3.4 Git Constraints

**✅ DO:**
- Create feature branches
- Write meaningful commit messages
- Keep commits small and focused

**❌ DON'T:**
- Push directly to main branch
- Make large commits
- Commit generated files (node_modules, venv, etc.)

---

## 4. Quality Gates

Before every commit/PR:

- [ ] Build succeeds
- [ ] Lint check passes
- [ ] All tests pass
- [ ] No type errors
- [ ] Documentation updated (if needed)

---

## 5. Development Workflow

### 5.1 Feature Development

```
1. Create feature branch
   git checkout -b feature/feature-name

2. Write tests first (Red)
   - Define expected behavior
   - Run tests → should fail

3. Implement minimum code (Green)
   - Make tests pass
   - Don't over-engineer

4. Refactor
   - Improve code quality
   - Keep tests passing

5. Run quality gates
   - Lint, test, build

6. Create PR
   - Describe changes
   - Link to issue/task
```

### 5.2 Checklist-Driven Development

For complex features, break down into checkboxes:

```markdown
## Feature: User Authentication

### Phase 1: Setup
- [ ] Create user entity
- [ ] Create user repository interface
- [ ] Implement repository

### Phase 2: Use Cases
- [ ] Login use case
- [ ] Register use case
- [ ] Tests for each

### Phase 3: API
- [ ] Login endpoint
- [ ] Register endpoint
- [ ] Integration tests
```

---

## 6. AI-Assisted Development Tips

### 6.1 Context is Everything

- Keep related code together
- Use clear, descriptive names
- Add comments for complex logic
- Tests serve as documentation

### 6.2 Working with AI

**DO:**
- Give clear, specific instructions
- Provide context (relevant files, requirements)
- Review AI output before committing
- Use AI for boilerplate, focus on logic yourself

**DON'T:**
- Accept AI code blindly
- Skip testing AI-generated code
- Let AI make architectural decisions alone

### 6.3 Effective Prompts

```
Bad:  "Make a login feature"

Good: "Create a login use case in application/use_cases/
       - Input: email, password
       - Output: JWT token or error
       - Use UserRepository interface (don't import infrastructure)
       - Write tests first in tests/unit/use_cases/test_login.py"
```

---

## 7. Project Structure Template

### 7.1 Backend (Python/FastAPI)

```
project/
├── main.py                  # Entry point
├── domain/
│   ├── entities/            # Business objects
│   ├── value_objects/       # Immutable values
│   └── exceptions.py        # Domain exceptions
├── application/
│   ├── interfaces/          # Ports (abstract interfaces)
│   └── use_cases/           # Business operations
├── infrastructure/
│   ├── database/
│   │   ├── client.py        # DB connection
│   │   └── repositories/    # Repository implementations
│   ├── external/            # External API clients
│   └── storage/             # File storage
├── presentation/
│   ├── api/
│   │   └── v1/              # API endpoints
│   └── schemas/             # Request/Response DTOs
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── requirements.txt
└── pyproject.toml
```

### 7.2 Frontend (React/TypeScript)

```
frontend/
├── src/
│   ├── api/                 # API client
│   ├── components/
│   │   ├── common/          # Shared components
│   │   ├── layout/          # Layout components
│   │   └── ui/              # UI primitives
│   ├── pages/               # Page components
│   ├── stores/              # State management
│   ├── hooks/               # Custom hooks
│   ├── types/               # TypeScript types
│   ├── utils/               # Utility functions
│   └── App.tsx
├── tests/
├── .env.local
└── package.json
```

---

## 8. Technology Recommendations

### 8.1 Backend

| Purpose | Recommended |
|---------|-------------|
| Python Web | FastAPI |
| Node.js Web | Express, Fastify |
| Database | PostgreSQL (Supabase) |
| ORM | SQLAlchemy, Prisma |
| Testing | pytest, Jest |
| Linting | Black + isort, ESLint + Prettier |

### 8.2 Frontend

| Purpose | Recommended |
|---------|-------------|
| Framework | React, Next.js |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| State | Zustand, TanStack Query |
| Testing | Vitest, Playwright |

### 8.3 Infrastructure

| Purpose | Recommended |
|---------|-------------|
| Database | Supabase, PlanetScale |
| File Storage | Google Drive, S3 |
| Auth | Supabase Auth, Clerk |
| Deploy | Vercel, Railway |

---

## 9. Common Patterns

### 9.1 Repository Pattern

```python
# Interface (Port) - in application/interfaces/
class UserRepository(ABC):
    @abstractmethod
    async def find_by_id(self, id: UUID) -> User | None:
        pass

# Implementation (Adapter) - in infrastructure/
class SupabaseUserRepository(UserRepository):
    async def find_by_id(self, id: UUID) -> User | None:
        # Actual DB query here
        pass
```

### 9.2 Use Case Pattern

```python
# in application/use_cases/
class LoginUseCase:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo  # Injected interface
    
    async def execute(self, email: str, password: str) -> Result:
        user = await self.user_repo.find_by_email(email)
        if not user or not user.verify_password(password):
            return Result.fail("Invalid credentials")
        return Result.ok(user.generate_token())
```

### 9.3 Result Pattern

```python
@dataclass
class Result[T]:
    success: bool
    value: T | None = None
    error: str | None = None
    
    @classmethod
    def ok(cls, value: T) -> "Result[T]":
        return cls(success=True, value=value)
    
    @classmethod
    def fail(cls, error: str) -> "Result[T]":
        return cls(success=False, error=error)
```

---

## 10. Checklist: New Project Setup

### Phase 0: Planning
- [ ] Define project scope
- [ ] Choose tech stack
- [ ] Create PRD (Product Requirements Document)
- [ ] Create ERD (Entity Relationship Diagram)
- [ ] Define Constitution (constraints)

### Phase 1: Environment
- [ ] Initialize repository
- [ ] Setup linters/formatters
- [ ] Create project structure
- [ ] Setup environment variables
- [ ] Configure CI/CD (optional)

### Phase 2: Foundation
- [ ] Database schema/migrations
- [ ] Domain entities
- [ ] Repository interfaces
- [ ] Basic API structure

### Phase 3: Core Features
- [ ] Use cases (with tests)
- [ ] Repository implementations
- [ ] API endpoints
- [ ] Frontend pages

### Phase 4: Polish
- [ ] Error handling
- [ ] Logging
- [ ] Documentation
- [ ] Performance optimization

---

## Summary

| Principle | Key Point |
|-----------|-----------|
| **Quality** | Lint, test, document |
| **Architecture** | Clean layers, dependency inversion |
| **Constitution** | Define constraints first |
| **TDD** | Red → Green → Refactor |
| **AI-Assisted** | Clear context, review output |
| **Workflow** | Feature branch, small commits, quality gates |

---

## Quick Reference

### Commands

```bash
# Python
pip install black isort flake8 pytest
black .
isort .
pytest --cov

# Node.js
npm install eslint prettier
npm run lint
npm run test
```

### Git Commit Convention

```
feat:     New feature
fix:      Bug fix
refactor: Code refactoring
test:     Add/update tests
docs:     Documentation
chore:    Maintenance
```

---

> "The best code is code that AI and humans can both understand."
