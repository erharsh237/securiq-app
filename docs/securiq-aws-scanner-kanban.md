# Securiq AWS Scanner — Kanban Board

## 📋 Backlog
- IAM privilege escalation chain detection (advanced check)
- Public snapshot/AMI checks
- CloudTrail gap checks
- Basic auth for triggering scans/fixes
- Audit log of applied fixes
- PDF/JSON report export

## 📝 To Do

### Backend A (Collectors + DB)
- [ ] Set up Node project, install Express + AWS SDK v3 + dotenv
- [ ] Set up AWS test account with intentionally broken resources
- [ ] Create read-only IAM role/keys for the app
- [ ] `config/awsClient.js` — AWS session setup
- [ ] `models/Finding.js` — DB schema (resource_type, resource_id, issue, severity, status, detected_at)
- [ ] `s3Collector.js`
- [ ] `ec2Collector.js` (security groups + EBS)
- [ ] `iamCollector.js`
- [ ] `rdsCollector.js`

### Backend B (Scanners + Remediation + API)
- [ ] `s3Scanner.js` — public bucket + encryption checks
- [ ] `sgScanner.js` — open port 22/3389 checks
- [ ] `iamScanner.js` — wildcard permission checks
- [ ] `encryptionScanner.js` — EBS/RDS
- [ ] `s3Fix.js` — enable Block Public Access + encryption (dry-run mode first)
- [ ] `sgFix.js` — restrict CIDR
- [ ] Routes: `/scan`, `/findings`, `/fix`

### Frontend
- [ ] Scaffold React app
- [ ] Build FindingsTable component against mock JSON
- [ ] ScanButton component
- [ ] FixButton component (with confirmation before applying)
- [ ] Wire up API calls once backend routes are live

## 🔨 In Progress
*(empty — move cards here as work starts)*

## 👀 Review
*(empty — PRs / testing before merge)*

## ✅ Done
*(empty)*

---

**Suggested first sprint (Week 1 goal):** Backend A ships `s3Collector.js` + DB model → Backend B builds `s3Scanner.js` against it → Frontend shows results in FindingsTable using mock data in parallel. That's your first vertical slice: connect → collect → scan → display.
