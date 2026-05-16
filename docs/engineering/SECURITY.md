# Security Guidelines --- AI Developer Second Brain

## 1. Introduction
This document outlines the security practices and policies for the AI Developer Second Brain project. We are committed to protecting user data and repository integrity.

## 2. Authentication and Authorization
- **User Authentication:** We use JSON Web Tokens (JWT) for user session management. Tokens should be stored securely on the client (e.g., in `HttpOnly` cookies to prevent XSS attacks).
- **Repository Access:** For accessing private repositories, we use GitHub OAuth or Personal Access Tokens (PATs). We always request the minimum required scopes (e.g., read-only access).

## 3. Secret Management
- **No Secrets in Code:** Never hardcode API keys, database passwords, or tokens in the codebase.
- **Local Development:** Use a `.env` file in the project root to store local secrets. Ensure `.env` is listed in `.gitignore`.
- **Production:** Use environment variables or a secret manager (e.g., AWS Secrets Manager, HashiCorp Vault) to inject secrets into the containers.

## 4. Encryption
- **In Transit:** All external communication must go over HTTPS. Internal service-to-service communication should use TLS where possible.
- **At Rest:** Database backups and data volumes should be encrypted at rest (this is typically handled by the cloud provider for managed databases).
- **Sensitive Data:** GitHub access tokens stored in the database must be encrypted at the application level before insertion, using a strong encryption standard like `AES-256-GCM`.

## 5. Vulnerability Handling
- **Dependency Scanning:** We use tools like `Dependabot` or `npm audit` to check for known vulnerabilities in our dependencies.
- **Reporting:** If you discover a security vulnerability, please do not open a public issue. Instead, report it responsibly by contacting the maintainers at `security@example.com` (placeholder).
- **Updates:** Dependencies with critical vulnerabilities must be updated or replaced immediately.
