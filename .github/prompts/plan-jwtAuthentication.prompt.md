## Plan: Add JWT Authentication Across Full Stack

The application currently has **zero API protection** — login is cosmetic (client-side only), and all **30 endpoints** are publicly accessible. The plan introduces JWT access + refresh tokens on the FastAPI backend, a centralized authenticated fetch utility on the React frontend, and protects every endpoint except login/register — without breaking existing functionality.

---

### Steps

#### 1. Add backend JWT dependencies and config

- Add `python-jose[cryptography]` to `backend/requirements.txt`.
- In `backend/config.py`, add new env vars: `JWT_SECRET_KEY` (random 256-bit key), `JWT_ALGORITHM` (default `HS256`), `ACCESS_TOKEN_EXPIRE_MINUTES` (default `30`), and `REFRESH_TOKEN_EXPIRE_DAYS` (default `7`). Load them from `.env`.

#### 2. Create a backend auth middleware / dependency

- Create a new file `backend/api/middleware.py` with:
  - A `create_access_token(data, expires_delta)` function that encodes `{sub: user_id, email, role, exp}` claims.
  - A `create_refresh_token(data)` function with a longer expiry.
  - A FastAPI `Depends` dependency `get_current_user(token)` that extracts the `Authorization: Bearer <token>` header, decodes/validates the JWT, and returns the user payload — raising `HTTPException(401)` on failure.
  - An optional `require_role(role)` dependency for admin-only endpoints if needed later.

#### 3. Update the login/register endpoints to issue JWTs

- In `backend/api/auth.py`, modify the `/login` response to return `{ access_token, refresh_token, token_type: "bearer", user: {...} }` instead of the raw user object.
- Add a new `POST /auth/refresh` endpoint that accepts a refresh token and returns a new access token (for silent re-auth).
- Keep `POST /auth/login` and `POST /auth/register` **unprotected**; protect `GET /auth/user/{id}` with the new dependency.

#### 4. Protect all other API endpoints with the JWT dependency

- In every route file — `batch.py`, `student.py`, `exam.py`, `analysis.py`, `achiever.py` — add `current_user: dict = Depends(get_current_user)` as a parameter to **every route function**.
- This covers all ~27 remaining endpoints. Each will return `401 Unauthorized` if no valid token is present.

#### 5. Create a frontend authenticated fetch utility and update Login

- Create a new file `frontend/src/utils/api.js` exporting an `authFetch(url, options)` wrapper that:
  - Reads the access token from `localStorage` (key `graavitons_token`).
  - Injects `Authorization: Bearer <token>` into every request header.
  - On a `401` response, attempts a silent refresh using the stored refresh token; if refresh fails, clears storage and redirects to login.
- Update `Login.js` to store `access_token` and `refresh_token` in `localStorage` (alongside the existing `graavitons_user` object).
- Update `App.js` logout handler to also clear token keys from `localStorage`.

#### 6. Replace all raw `fetch()` calls with `authFetch()` across every component

- Systematically update every `fetch()` call in these components to use the new `authFetch` utility:
  - `Dashboard.js` — batch list, delete batch
  - `BatchDetail.js` — student list, batch report
  - `BatchPerformance.js` — performance data
  - `AddBatch.js` — create batch
  - `AddStudent.js` — create/update/upload student
  - `AddExam.js` — templates, create tests
  - `StudentProfile.js` — student details, analysis, feedback
  - `AchieversSection.js` — list/delete achievers
  - `AddAchiever.js` — batches, students, create achiever
- No changes needed for `AchieverCard.js` or `Header.js` (no API calls).

---

### Further Considerations

1. **Token storage strategy:** `localStorage` is simple but vulnerable to XSS. An alternative is `httpOnly` cookies (more secure, but requires backend `Set-Cookie` changes and CORS `allow_credentials` fix for the current `*` origin). Recommend starting with `localStorage` + Bearer header for simplicity.
2. **CORS tightening:** The current `server.py` allows `origins=["*"]` with `credentials=True` (spec-invalid). Should lock `CORS_ORIGINS` to the actual frontend URL (e.g., `http://localhost:3000`) now, or keep it as a later hardening step.
3. **Role-based access control:** The `users` table has a `role` column (`Admin`/`Teacher`). Should certain endpoints (e.g., delete batch, register user) be restricted to `Admin` only in this pass, or just enforce "authenticated" for now and add RBAC later.
