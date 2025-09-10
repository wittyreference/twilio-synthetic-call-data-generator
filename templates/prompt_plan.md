# Prompt Plan Template

## Project Context
**Project:** [Project name from spec.md]
**Goal:** [High-level objective]
**Timeline:** [Expected completion timeframe]

## Architecture Overview

### Technology Stack
- **Backend:** Node.js, Twilio Functions
- **Frontend:** [If applicable]
- **Database:** [Database choice]
- **Testing:** Jest, pytest, Newman
- **Deployment:** Twilio Serverless

### Key Components
1. **Component 1:** [Brief description]
2. **Component 2:** [Brief description]
3. **Component 3:** [Brief description]

## Implementation Plan

### Phase 1: Foundation (TDD Approach)
**Objective:** Set up core infrastructure and basic functionality

#### Tasks:
1. **Setup Development Environment**
   - Initialize Twilio Functions project
   - Configure testing frameworks
   - Set up CI/CD pipeline

2. **Core Data Models**
   - Define data structures
   - Write unit tests for models
   - Implement model classes

3. **Basic API Endpoints**
   - Write API tests first
   - Implement core endpoints
   - Add error handling

### Phase 2: Core Features
**Objective:** Implement main functionality

#### Tasks:
1. **Feature 1 Implementation**
   - Write failing tests
   - Implement minimum viable code
   - Refactor for quality

2. **Feature 2 Implementation**
   - [Follow TDD cycle]

3. **Integration Testing**
   - Test component interactions
   - Validate end-to-end flows

### Phase 3: Enhancement & Polish
**Objective:** Optimize and prepare for production

#### Tasks:
1. **Performance Optimization**
   - Identify bottlenecks
   - Implement caching
   - Load testing

2. **Security Hardening**
   - Input validation
   - Authentication/authorization
   - Security testing

3. **Documentation**
   - API documentation
   - User guides
   - Deployment procedures

## Testing Strategy

### Test-Driven Development Approach
1. **Red:** Write failing test
2. **Green:** Write minimal code to pass
3. **Refactor:** Improve code quality

### Test Coverage Goals
- Unit tests: >80% coverage
- Integration tests: All major workflows
- E2E tests: Critical user paths

### Test Categories
- **Unit Tests:** Individual function testing
- **Integration Tests:** Component interactions
- **API Tests:** Endpoint validation
- **Load Tests:** Performance validation

## Development Workflow

### Daily Process
1. Review todo.md for current tasks
2. Select next task following TDD
3. Write failing test
4. Implement minimal solution
5. Refactor and optimize
6. Update todo.md progress
7. Create GitHub issue if needed

### Code Quality Standards
- All code reviewed before merge
- Linting passes (ESLint, Black)
- Tests pass (Jest, pytest, Newman)
- Documentation updated

### Git Workflow
- Feature branches from main
- Pull requests for all changes
- Automated testing on PRs
- Squash merge to main

## Risk Management

### Technical Risks
1. **Twilio API Rate Limits**
   - Mitigation: Implement exponential backoff
   - Monitoring: Track API usage

2. **Third-party Dependencies**
   - Mitigation: Pin versions, test updates
   - Monitoring: Security vulnerability scans

### Project Risks
1. **Scope Creep**
   - Mitigation: Strict adherence to spec.md
   - Review: Weekly scope validation

2. **Timeline Pressure**
   - Mitigation: Prioritize MVP features
   - Fallback: Reduce nice-to-have features

## Success Metrics

### Technical Metrics
- [ ] Test coverage >80%
- [ ] Build success rate >95%
- [ ] API response time <500ms
- [ ] Zero critical security issues

### Project Metrics
- [ ] All MVP features delivered
- [ ] Documentation complete
- [ ] Deployment successful
- [ ] Post-launch monitoring active

## Agent Collaboration Strategy

### Prompt Engineering
- Use specific, actionable prompts
- Include context from spec.md
- Reference existing code patterns

### Task Breakdown
- Keep tasks small and focused
- One feature per development cycle
- Clear acceptance criteria

### Quality Assurance
- Automated testing at each step
- Code review for major changes
- Regular integration validation

## Resource Requirements

### Development Tools
- IDE: VS Code with recommended extensions
- Version Control: Git with GitHub
- Testing: Jest, pytest, Newman
- Deployment: Twilio CLI

### External Services
- Twilio account with API credentials
- GitHub repository with Actions enabled
- Code coverage tracking (optional)

## Delivery Plan

### Milestones
1. **Week 1:** Foundation and core setup
2. **Week 2:** MVP feature implementation
3. **Week 3:** Testing and integration
4. **Week 4:** Polish and deployment

### Deliverables
- [ ] Working application
- [ ] Test suites (unit, integration, E2E)
- [ ] Documentation
- [ ] Deployment pipeline
- [ ] Monitoring setup

### Handoff Requirements
- [ ] Code repository with full history
- [ ] Deployment documentation
- [ ] API documentation
- [ ] Troubleshooting guide
- [ ] Maintenance procedures