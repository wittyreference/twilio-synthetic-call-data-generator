# Security Policy

## 🔒 Reporting a Vulnerability

**We take security seriously.** If you discover a security vulnerability, please help us protect our users by following responsible disclosure practices.

### ⚠️ DO NOT

- **Do not** open a public GitHub issue for security vulnerabilities
- **Do not** discuss the vulnerability in public forums, chat rooms, or social media
- **Do not** exploit the vulnerability beyond what's necessary to demonstrate it

### ✅ DO

**Report vulnerabilities privately via one of these methods:**

1. **Preferred**: Use GitHub's private vulnerability reporting
   - Go to the [Security tab](https://github.com/mcarpenter/twilio-synthetic-call-data-generator/security)
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Alternative**: Email security contact
   - Send details to: **security@[your-domain].com**
   - Use subject line: `[SECURITY] Twilio Synthetic Call Generator - [Brief Description]`
   - Include your GitHub username for credit

### 📋 What to Include

Please provide:

1. **Vulnerability Description**
   - What is the vulnerability?
   - What component/file is affected?

2. **Impact Assessment**
   - What can an attacker do with this vulnerability?
   - What data/systems are at risk?
   - Rate severity: Critical / High / Medium / Low

3. **Steps to Reproduce**
   - Detailed, numbered steps to reproduce
   - Include code samples, curl commands, or screenshots
   - Specify environment (Node version, OS, etc.)

4. **Proof of Concept**
   - Demonstration code (if applicable)
   - **Do not** include actual exploits against live systems
   - Sanitize any sensitive data

5. **Suggested Fix** (optional)
   - If you have ideas for how to fix it, we'd love to hear them

6. **Credit Preferences**
   - How would you like to be credited if we publish an advisory?
   - GitHub username, real name, or anonymous?

## ⏱️ Response Timeline

We commit to:

- **Initial response**: Within **48 hours** of report
- **Assessment**: Within **5 business days** - we'll confirm or request more info
- **Fix timeline**: Depends on severity
  - **Critical**: 7 days
  - **High**: 30 days
  - **Medium**: 60 days
  - **Low**: 90 days
- **Public disclosure**: After fix is deployed and users have time to update

## 🛡️ Supported Versions

We provide security updates for:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Yes             |
| < 1.0   | ❌ No (upgrade)    |

**Recommendation**: Always use the latest release.

## 🔐 Security Best Practices for Users

### Environment Variables

**Never commit credentials to version control:**

```bash
# ✅ Good - using .env file
TWILIO_AUTH_TOKEN=your_token_here

# ❌ Bad - hardcoded in source
const authToken = "SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Check git history** for accidentally committed secrets:

```bash
git log --all --full-history --pretty=format:'%H' -- '.env'
```

If `.env` was ever committed:
1. **Rotate all credentials immediately**
2. Use `git filter-branch` or BFG Repo-Cleaner to remove from history
3. Force push (if repo is private) or recreate repo

### Twilio Security

1. **Use Auth Tokens, not API Keys** for serverless functions
2. **Enable webhook validation** (we do this by default)
3. **Restrict Auth Token permissions** in Twilio Console
4. **Use subaccounts** for different environments (dev/staging/prod)
5. **Monitor usage** for unexpected spikes

### Dependency Security

**Keep dependencies updated:**

```bash
# Check for known vulnerabilities
npm audit

# Fix automatically (where possible)
npm audit fix

# Update specific packages
npm update <package-name>
```

**We use Dependabot** to automatically create PRs for security updates.

### OpenAI API Security

1. **Set usage limits** in OpenAI dashboard
2. **Use separate API keys** for dev/prod
3. **Monitor costs** daily
4. **Rotate keys** if compromised
5. **Use `MAX_DAILY_CALLS`** env var to cap spend

### Segment Security

1. **Restrict Write Keys** to specific sources
2. **Don't send PII** unless required and compliant
3. **Use schema validation** to prevent data leakage
4. **Review destinations** periodically

## 🚨 Known Security Considerations

### Rate Limiting

**Cost Protection**: `MAX_DAILY_CALLS` environment variable limits OpenAI API calls to prevent runaway costs.

```env
MAX_DAILY_CALLS=1000  # Default: 1000 calls/day
```

**Best practice**: Set this based on your budget and expected usage.

### Webhook Validation

**All webhooks validate Twilio signatures** to prevent unauthorized requests:

```javascript
// Automatic in all webhook functions
if (!validateOrReject(context, event, callback)) {
  return; // Rejects invalid signatures
}
```

**Do not disable** webhook validation in production.

### Conversation History Storage

**Twilio Sync is used** for conversation state. Data expires after 1 hour by default.

**PII considerations**: Conversation transcripts may contain PII. Ensure compliance with:
- GDPR (if serving EU users)
- CCPA (if serving California users)
- HIPAA (if handling health data)

### Voice Intelligence

**Transcripts are processed** by Twilio Voice Intelligence which may retain data per their [data retention policy](https://www.twilio.com/legal/data-protection-addendum).

**Review**: Twilio's DPA if handling sensitive data.

## 🏅 Security Hall of Fame

We recognize researchers who responsibly disclose vulnerabilities:

<!-- No reports yet -->
_No vulnerabilities reported yet. Be the first!_

## 📞 Contact

- **Security issues**: Via GitHub Security tab or security@[domain].com
- **General questions**: Open a GitHub Discussion
- **Non-security bugs**: Open a GitHub Issue

## 📜 Disclosure Policy

When a vulnerability is fixed:

1. We'll publish a **Security Advisory** on GitHub
2. We'll credit the reporter (unless they request anonymity)
3. We'll include:
   - CVE ID (if applicable)
   - Severity rating
   - Affected versions
   - Fix version
   - Mitigation steps

## 🙏 Thank You

Thank you for helping keep this project and its users safe!

Security researchers who follow responsible disclosure are valued members of our community.
