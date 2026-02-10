# User Flows

## Overview
This document maps out the complete user journeys for all personas in the AI-Pajak system. Each flow represents a typical task or goal that users need to accomplish.

---

## 1. Tax Consultant Flow

### 1.1 Client Onboarding Flow

```mermaid
flowchart TD
    Start([Tax Consultant Login]) --> Dashboard[View Dashboard]
    Dashboard --> AddClient[Click 'Add New Client']
    AddClient --> ClientForm[Fill Client Information]
    ClientForm --> ValidateNPWP{NPWP Valid?}
    ValidateNPWP -->|No| ShowError[Show Validation Error]
    ShowError --> ClientForm
    ValidateNPWP -->|Yes| SelectPackage[Select Service Package]
    SelectPackage --> ReviewInfo[Review Client Information]
    ReviewInfo --> SubmitClient[Submit Client Profile]
    SubmitClient --> AutoAssign{Auto-assign to<br/>Accountant?}
    AutoAssign -->|Yes| AssignAccount[System Assigns Accountant]
    AutoAssign -->|No| ManualAssign[Manually Assign Accountant]
    AssignAccount --> Notification[Send Notification to Accountant]
    ManualAssign --> Notification
    Notification --> Success([Client Onboarded])
```

**Entry Points:**
- Dashboard > "Add Client" button
- Quick action menu
- Clients list > "New Client"

**Exit Points:**
- Client profile page
- Clients list with new client
- Dashboard with updated metrics

**Key Decision Points:**
- NPWP validation
- Service package selection
- Accountant assignment method

**Error Scenarios:**
- Invalid NPWP format
- Duplicate client detection
- Missing required fields
- No available accountants

---

### 1.2 Tax Filing Management Flow

```mermaid
flowchart TD
    Start([View Client List]) --> SelectClient[Select Client]
    SelectClient --> ClientDetail[View Client Details]
    ClientDetail --> CheckStatus{Tax Filing<br/>Status?}
    CheckStatus -->|Not Started| InitiateFiling[Initiate New Filing]
    CheckStatus -->|In Progress| ViewProgress[View Current Progress]
    CheckStatus -->|Completed| ViewHistory[View Filing History]

    InitiateFiling --> SelectPeriod[Select Tax Period]
    SelectPeriod --> UploadDocs[Upload Documents]
    UploadDocs --> AssignTask[Assign to Accountant]
    AssignTask --> SetDeadline[Set Internal Deadline]
    SetDeadline --> NotifyAccountant[Notify Accountant]
    NotifyAccountant --> Monitor([Monitor Progress])

    ViewProgress --> Actions{Available<br/>Actions?}
    Actions -->|Review| ReviewDraft[Review Draft Filing]
    Actions -->|Message| SendMessage[Message Accountant]
    Actions -->|Update| UpdateDeadline[Update Deadline]

    ReviewDraft --> Approve{Approve<br/>Draft?}
    Approve -->|Yes| MarkForSubmission[Mark Ready for Submission]
    Approve -->|No| RequestRevision[Request Revisions]
    RequestRevision --> Monitor

    MarkForSubmission --> FinalReview[Final Review Checklist]
    FinalReview --> SubmitToDJP[Submit to DJP]
    SubmitToDJP --> Confirmation([Submission Confirmed])
```

**Entry Points:**
- Client dashboard
- Clients list
- Task notifications
- Calendar view

**Exit Points:**
- Filing submitted successfully
- Draft saved for later
- Revision requested
- Task reassigned

**Key Decision Points:**
- Tax filing status check
- Document completeness validation
- Draft approval/rejection
- Submission timing

**Error Scenarios:**
- Missing documents
- DJP API connection failure
- Invalid tax calculations
- Deadline conflicts

---

### 1.3 Client Communication Flow

```mermaid
flowchart TD
    Start([Receive Client Inquiry]) --> CheckChannel{Communication<br/>Channel?}
    CheckChannel -->|In-App| InAppMsg[View In-App Message]
    CheckChannel -->|Email| EmailSync[Email Synced to System]
    CheckChannel -->|WhatsApp| WhatsAppIntegration[WhatsApp Integration]

    InAppMsg --> Review[Review Inquiry]
    EmailSync --> Review
    WhatsAppIntegration --> Review

    Review --> CheckType{Inquiry<br/>Type?}
    CheckType -->|Document Request| PrepareDoc[Prepare Document]
    CheckType -->|Question| DraftResponse[Draft Response]
    CheckType -->|Complaint| EscalateFlag[Flag for Escalation]

    PrepareDoc --> AttachFile[Attach Files]
    AttachFile --> SendResponse[Send Response]

    DraftResponse --> CheckKB{Check Knowledge<br/>Base?}
    CheckKB -->|Yes| SearchKB[Search Knowledge Base]
    CheckKB -->|No| SendResponse
    SearchKB --> UseTemplate{Use<br/>Template?}
    UseTemplate -->|Yes| LoadTemplate[Load Template Response]
    UseTemplate -->|No| CustomResponse[Write Custom Response]
    LoadTemplate --> SendResponse
    CustomResponse --> SendResponse

    EscalateFlag --> NotifyManager[Notify Manager]
    NotifyManager --> SendResponse

    SendResponse --> LogInteraction[Log Interaction]
    LogInteraction --> SetFollowUp{Needs<br/>Follow-up?}
    SetFollowUp -->|Yes| CreateReminder[Create Follow-up Reminder]
    SetFollowUp -->|No| MarkResolved[Mark as Resolved]
    CreateReminder --> Done([Inquiry Handled])
    MarkResolved --> Done
```

**Entry Points:**
- Message center
- Client profile
- Push notifications
- Email notifications

**Exit Points:**
- Message sent
- Follow-up scheduled
- Issue escalated
- Case closed

**Key Decision Points:**
- Communication channel routing
- Inquiry type classification
- Template vs custom response
- Escalation criteria

**Error Scenarios:**
- File attachment too large
- Template not available
- Client not found
- Message delivery failure

---

## 2. Accountant Flow

### 2.1 Task Assignment & Completion Flow

```mermaid
flowchart TD
    Start([Login to System]) --> ViewTasks[View Assigned Tasks]
    ViewTasks --> FilterTasks{Filter<br/>Tasks?}
    FilterTasks -->|By Priority| HighPriority[View High Priority]
    FilterTasks -->|By Deadline| Upcoming[View Upcoming Deadlines]
    FilterTasks -->|By Client| ClientTasks[View Client Tasks]

    HighPriority --> SelectTask[Select Task]
    Upcoming --> SelectTask
    ClientTasks --> SelectTask

    SelectTask --> TaskDetail[View Task Details]
    TaskDetail --> CheckDocs{Documents<br/>Complete?}
    CheckDocs -->|No| RequestDocs[Request Missing Documents]
    CheckDocs -->|Yes| StartWork[Start Working on Task]

    RequestDocs --> WaitResponse[Wait for Response]
    WaitResponse --> CheckReceived{Documents<br/>Received?}
    CheckReceived -->|Yes| StartWork
    CheckReceived -->|No| FollowUp{Send<br/>Follow-up?}
    FollowUp -->|Yes| RequestDocs
    FollowUp -->|No| ReportBlock[Report Blocker]

    StartWork --> EnterData[Enter Tax Data]
    EnterData --> AIValidation{AI Validation<br/>Pass?}
    AIValidation -->|No| ShowSuggestions[Show AI Suggestions]
    ShowSuggestions --> ReviewSugg{Accept<br/>Suggestions?}
    ReviewSugg -->|Yes| ApplySugg[Apply Suggestions]
    ReviewSugg -->|No| ManualFix[Manual Correction]
    ApplySugg --> EnterData
    ManualFix --> EnterData

    AIValidation -->|Yes| CalculateTax[Calculate Tax Liability]
    CalculateTax --> ReviewCalc[Review Calculations]
    ReviewCalc --> GenerateReport[Generate Tax Report]
    GenerateReport --> InternalReview[Internal Review Checklist]
    InternalReview --> PassCheck{Pass All<br/>Checks?}
    PassCheck -->|No| FixIssues[Fix Issues]
    FixIssues --> InternalReview
    PassCheck -->|Yes| SubmitReview[Submit for Consultant Review]
    SubmitReview --> UpdateStatus[Update Task Status]
    UpdateStatus --> Done([Task Completed])
```

**Entry Points:**
- Task dashboard
- Email notifications
- Calendar reminders
- Mobile app notifications

**Exit Points:**
- Task submitted for review
- Task saved as draft
- Blocker reported
- Task reassigned

**Key Decision Points:**
- Document completeness check
- AI validation acceptance
- Internal quality checks
- Submission readiness

**Error Scenarios:**
- Missing critical documents
- AI validation failures
- Calculation discrepancies
- System timeout during save

---

### 2.2 Document Processing Flow

```mermaid
flowchart TD
    Start([Receive Documents]) --> UploadMethod{Upload<br/>Method?}
    UploadMethod -->|Bulk Upload| BulkProcess[Bulk Document Upload]
    UploadMethod -->|Single File| SingleUpload[Single File Upload]
    UploadMethod -->|Scan| ScanDoc[Scan Document]

    BulkProcess --> AIExtract[AI Document Extraction]
    SingleUpload --> AIExtract
    ScanDoc --> OCR[OCR Processing]
    OCR --> AIExtract

    AIExtract --> Preview[Preview Extracted Data]
    Preview --> Verify{Data<br/>Accurate?}
    Verify -->|No| ManualEdit[Manual Data Entry]
    Verify -->|Yes| Categorize[Auto-categorize Document]

    ManualEdit --> Categorize
    Categorize --> LinkClient[Link to Client/Tax Period]
    LinkClient --> ValidateDoc{Document<br/>Valid?}
    ValidateDoc -->|No| FlagIssue[Flag Document Issue]
    ValidateDoc -->|Yes| StoreDoc[Store in Document Repository]

    FlagIssue --> NotifyConsultant[Notify Tax Consultant]
    NotifyConsultant --> ResolveIssue{Issue<br/>Resolved?}
    ResolveIssue -->|Yes| StoreDoc
    ResolveIssue -->|No| WaitResolution[Wait for Resolution]

    StoreDoc --> UpdateProgress[Update Task Progress]
    UpdateProgress --> MoreDocs{More<br/>Documents?}
    MoreDocs -->|Yes| Start
    MoreDocs -->|No| Complete([Processing Complete])
```

**Entry Points:**
- Task detail page
- Document upload center
- Email attachments
- Mobile camera

**Exit Points:**
- Documents stored successfully
- Issues flagged for review
- Processing queue
- Client notification sent

**Key Decision Points:**
- Upload method selection
- Data accuracy verification
- Document validation
- Issue resolution path

**Error Scenarios:**
- OCR failure
- Unsupported file format
- Missing metadata
- Storage quota exceeded

---

## 3. Executive/Business Owner Flow

### 3.1 Mobile Approval Flow

```mermaid
flowchart TD
    Start([Receive Push Notification]) --> OpenApp[Open Mobile App]
    OpenApp --> ViewApproval[View Pending Approval]
    ViewApproval --> CheckType{Approval<br/>Type?}

    CheckType -->|Tax Filing| TaxApproval[Tax Filing Approval]
    CheckType -->|Expense| ExpenseApproval[Expense Approval]
    CheckType -->|Document| DocApproval[Document Signature]

    TaxApproval --> ReviewSummary[Review Tax Summary]
    ReviewSummary --> ViewDetails{View Full<br/>Details?}
    ViewDetails -->|Yes| ExpandedView[View Detailed Report]
    ViewDetails -->|No| QuickDecision[Quick Decision View]

    ExpandedView --> CheckCalc[Check Calculations]
    CheckCalc --> ViewDocs[View Supporting Documents]
    ViewDocs --> MakeDecision{Decision?}

    QuickDecision --> MakeDecision

    MakeDecision -->|Approve| BiometricAuth[Biometric Authentication]
    MakeDecision -->|Reject| RejectReason[Provide Rejection Reason]
    MakeDecision -->|Defer| ScheduleReview[Schedule Later Review]

    BiometricAuth --> AuthSuccess{Auth<br/>Success?}
    AuthSuccess -->|No| RetryAuth[Retry Authentication]
    RetryAuth --> BiometricAuth
    AuthSuccess -->|Yes| ConfirmApproval[Confirm Approval]

    ConfirmApproval --> DigitalSign[Apply Digital Signature]
    DigitalSign --> NotifyTeam[Notify Tax Consultant]
    NotifyTeam --> LogAction[Log Approval Action]
    LogAction --> AutoSubmit{Auto-submit<br/>to DJP?}
    AutoSubmit -->|Yes| TriggerSubmission[Trigger DJP Submission]
    AutoSubmit -->|No| AwaitManual[Await Manual Submission]

    RejectReason --> NotifyTeam
    ScheduleReview --> SetReminder[Set Reminder]
    SetReminder --> Done([Approval Processed])

    TriggerSubmission --> Done
    AwaitManual --> Done
```

**Entry Points:**
- Push notification
- Email link
- App home screen
- WhatsApp message link

**Exit Points:**
- Approval granted
- Approval rejected
- Review deferred
- Session timeout

**Key Decision Points:**
- Detail level required
- Approval decision
- Authentication method
- Auto-submission preference

**Error Scenarios:**
- Biometric auth failure
- Network connection lost
- Session expired
- Invalid digital signature

---

### 3.2 Dashboard Monitoring Flow

```mermaid
flowchart TD
    Start([Open Executive Dashboard]) --> LoadData[Load Real-time Data]
    LoadData --> ViewKPI[View Key Performance Indicators]
    ViewKPI --> SelectMetric{Select<br/>Metric?}

    SelectMetric -->|Tax Compliance| ComplianceView[Compliance Overview]
    SelectMetric -->|Financial| FinancialView[Financial Summary]
    SelectMetric -->|Team Performance| TeamView[Team Performance]
    SelectMetric -->|Alerts| AlertsView[View Alerts]

    ComplianceView --> DrillDown{Drill<br/>Down?}
    DrillDown -->|Yes| DetailedReport[View Detailed Report]
    DrillDown -->|No| ExportData{Export<br/>Data?}

    DetailedReport --> FilterOptions[Apply Filters]
    FilterOptions --> ViewChart[View Charts/Graphs]
    ViewChart --> ExportData

    ExportData -->|Yes| SelectFormat[Select Export Format]
    ExportData -->|No| SetAlert{Set<br/>Alert?}

    SelectFormat --> GenerateReport[Generate Report]
    GenerateReport --> EmailReport[Email Report]
    EmailReport --> Done([Dashboard Session Complete])

    SetAlert -->|Yes| ConfigureAlert[Configure Alert Criteria]
    SetAlert -->|No| Done
    ConfigureAlert --> SaveAlert[Save Alert]
    SaveAlert --> Done

    AlertsView --> ViewAlert[View Alert Details]
    ViewAlert --> TakeAction{Take<br/>Action?}
    TakeAction -->|Yes| DelegateTask[Delegate to Team]
    TakeAction -->|No| MarkReviewed[Mark as Reviewed]
    DelegateTask --> Done
    MarkReviewed --> Done
```

**Entry Points:**
- Direct app/web access
- Email dashboard link
- Scheduled report notification
- Mobile quick access

**Exit Points:**
- Report exported
- Alert configured
- Task delegated
- Session ended

**Key Decision Points:**
- Metric selection
- Drill-down depth
- Export vs alert
- Action required

**Error Scenarios:**
- Data loading failure
- Export timeout
- Email delivery failure
- Alert configuration error

---

## 4. Admin Flow

### 4.1 User Management Flow

```mermaid
flowchart TD
    Start([Access Admin Panel]) --> UserMgmt[User Management Section]
    UserMgmt --> Action{Admin<br/>Action?}

    Action -->|Create User| NewUser[Create New User]
    Action -->|Modify User| SelectUser[Select Existing User]
    Action -->|Deactivate| DeactivateUser[Deactivate User Account]
    Action -->|Audit| AuditLog[View Audit Logs]

    NewUser --> EnterDetails[Enter User Details]
    EnterDetails --> AssignRole[Assign Role & Permissions]
    AssignRole --> SetAccess[Set Access Levels]
    SetAccess --> GenerateCreds{Generate<br/>Credentials?}
    GenerateCreds -->|Auto| AutoGenerate[Auto-generate Password]
    GenerateCreds -->|Manual| ManualSet[Set Temporary Password]
    AutoGenerate --> SendInvite[Send Invitation Email]
    ManualSet --> SendInvite
    SendInvite --> LogCreation[Log User Creation]
    LogCreation --> Done([User Management Complete])

    SelectUser --> ViewProfile[View User Profile]
    ViewProfile --> ModifyAction{Modification<br/>Type?}
    ModifyAction -->|Role| ChangeRole[Change Role/Permissions]
    ModifyAction -->|Access| UpdateAccess[Update Access Levels]
    ModifyAction -->|Reset| ResetPassword[Reset Password]

    ChangeRole --> ConfirmChange[Confirm Changes]
    UpdateAccess --> ConfirmChange
    ResetPassword --> ConfirmChange
    ConfirmChange --> NotifyUser[Notify User]
    NotifyUser --> LogModification[Log Modification]
    LogModification --> Done
```

**Entry Points:**
- Admin panel
- User list
- Access request queue
- Audit notifications

**Exit Points:**
- User created/modified
- Credentials sent
- Access revoked
- Audit reviewed

**Key Decision Points:**
- User role assignment
- Credential generation method
- Access level granularity
- Notification preferences

**Error Scenarios:**
- Duplicate email/username
- Invalid role assignment
- Email sending failure
- Insufficient admin permissions

---

## 5. Cross-Persona Flows

### 5.1 Collaborative Filing Flow

```mermaid
flowchart TD
    Start([Tax Filing Initiated]) --> Consultant[Tax Consultant Creates Filing]
    Consultant --> AssignAcc[Assigns to Accountant]
    AssignAcc --> AccNotif[Accountant Receives Notification]

    AccNotif --> AccWork[Accountant Works on Filing]
    AccWork --> Progress{Progress<br/>Updates?}
    Progress -->|25%| Update25[Consultant Sees 25% Progress]
    Progress -->|50%| Update50[Consultant Sees 50% Progress]
    Progress -->|75%| Update75[Consultant Sees 75% Progress]

    Update25 --> AccWork
    Update50 --> AccWork
    Update75 --> AccComplete[Accountant Completes Draft]

    AccComplete --> ConsReview[Consultant Reviews Draft]
    ConsReview --> ConsDecision{Consultant<br/>Decision?}
    ConsDecision -->|Approve| MarkReady[Mark Ready for Client]
    ConsDecision -->|Revise| SendBack[Send Back to Accountant]

    SendBack --> AccWork

    MarkReady --> ExecNotif[Executive Receives Notification]
    ExecNotif --> ExecReview[Executive Reviews on Mobile]
    ExecReview --> ExecDecision{Executive<br/>Decision?}
    ExecDecision -->|Approve| ExecApprove[Executive Approves]
    ExecDecision -->|Question| AskQuestion[Ask Question]

    AskQuestion --> ConsAnswer[Consultant Answers]
    ConsAnswer --> ExecReview

    ExecApprove --> FinalSubmit[Consultant Submits to DJP]
    FinalSubmit --> AllNotif[All Parties Notified]
    AllNotif --> Complete([Filing Complete])
```

**Entry Points:**
- Any persona's dashboard
- Email/push notifications
- Task management system

**Exit Points:**
- Filing submitted
- Waiting for response
- Issue escalated
- Process cancelled

**Key Decision Points:**
- Assignment routing
- Review approval
- Executive approval
- Submission timing

**Error Scenarios:**
- Notification failure
- Assignment conflict
- Approval timeout
- DJP submission error

---

## Navigation Map

```mermaid
graph LR
    A[User Flows] --> B[Tax Consultant Flows]
    A --> C[Accountant Flows]
    A --> D[Executive Flows]
    A --> E[Admin Flows]
    A --> F[Cross-Persona Flows]

    B --> B1[Client Onboarding]
    B --> B2[Tax Filing Management]
    B --> B3[Client Communication]

    C --> C1[Task Assignment & Completion]
    C --> C2[Document Processing]

    D --> D1[Mobile Approval]
    D --> D2[Dashboard Monitoring]

    E --> E1[User Management]

    F --> F1[Collaborative Filing]
```

---

## Flow Metrics & Success Criteria

### Tax Consultant Flows
- **Client Onboarding**: < 5 minutes average completion time
- **Filing Management**: < 2 clicks to reach any filing status
- **Communication**: < 30 seconds to send response

### Accountant Flows
- **Task Completion**: < 30 minutes for standard filing
- **Document Processing**: < 3 minutes per document
- **AI Validation**: > 95% accuracy rate

### Executive Flows
- **Mobile Approval**: < 2 minutes total time
- **Dashboard Load**: < 3 seconds initial load
- **Export Generation**: < 10 seconds for standard report

### Cross-Persona Flows
- **Collaborative Filing**: < 48 hours total cycle time
- **Notification Delivery**: < 5 seconds
- **Review Cycles**: Average 1.5 cycles to approval

---

## Related Documentation
- [Wireframes](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/wireframes/)
- [Screen Specifications](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/screens/)
- [Design System](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/design-system.md)
- [API Endpoints](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/)
- [User Personas](/Users/tommy/git/ai-pajak/docs/01-requirements/personas.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Owner:** Product Design Team
**Review Cycle:** Monthly
