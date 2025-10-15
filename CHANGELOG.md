# Changelog

All notable changes to the Twilio Synthetic Call Data Generator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Conference auto-termination using Twilio's `timeLimit` parameter (5-minute maximum)
- OpenAI API compatibility regression tests (`tests/integration/openai-api-parameters.test.js`)
- Transcript content validation E2E tests (`tests/e2e/transcript-content-validation.test.js`)
- Runtime global mock in jest.setup.js for testing serverless functions
- Comprehensive documentation of cost controls and regression prevention

### Fixed
- **CRITICAL**: OpenAI API parameter compatibility for gpt-5-nano model
  - Changed deprecated `max_tokens` → `max_completion_tokens`
  - Removed unsupported `temperature` parameter
  - Resolves infinite error message loops in transcripts
- Conference duration issue - conferences now auto-terminate at 5 minutes (previously ran for 25+ minutes)
- Missing auto-termination implementation (was placeholder requiring external scheduler)

### Changed
- Updated conference participant creation to include `timeLimit: 300` parameter
- Updated `scheduleConferenceTermination` function metadata to reflect automatic termination
- Enhanced README.md with regression test documentation and cost control details

### Security
- Prevents runaway conference costs through automatic 5-minute termination
- Rate limiting via `MAX_DAILY_CALLS` environment variable

## [1.0.0] - 2025-10-15

### Added
- Initial release of Twilio Synthetic Call Data Generator
- AI-powered conversations using OpenAI GPT-5-nano
- Twilio Voice Intelligence transcription and language operators
- Segment CDP integration for customer profiling
- Random customer-agent pairing for realistic scenarios
- Comprehensive test suite (634 tests) across unit, integration, and E2E
- Production-grade error handling with retry logic and circuit breakers
- Webhook signature validation for security
- TwiML functions for conference orchestration
- Bulk call generation scripts
- Newman/Postman API testing
- GitHub Actions CI/CD pipeline

### Documentation
- Complete README with quick start guide
- Architecture documentation
- API reference documentation
- Deployment guides
- Error handling guide
- Segment CDP setup guide
- Event Streams setup guide
- Sync setup guide

---

## Version History Summary

- **v1.0.0** (2025-10-15): Initial production release
- **Unreleased**: Critical bug fixes for OpenAI API compatibility and conference auto-termination

## Migration Notes

### Upgrading to Latest (from v1.0.0)

No breaking changes. This release includes critical bug fixes:

1. **OpenAI API Fix**: No action required - automatically uses correct parameters
2. **Auto-termination**: Conferences now automatically end at 5 minutes (reduces costs)
3. **New Tests**: Run `npm test` to validate your environment

If you were experiencing "experiencing technical difficulties" error messages in transcripts, these are now resolved.

## Contributors

- Claude Code (AI Assistant)
- Michael Carpenter (@wittyreference)

## Support

For issues, questions, or contributions, please visit:
- GitHub Issues: https://github.com/wittyreference/twilio-synthetic-call-data-generator/issues
- Documentation: See README.md and docs/ directory
