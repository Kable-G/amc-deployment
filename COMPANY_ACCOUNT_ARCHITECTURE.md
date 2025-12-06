# AutoMediaCenter Company Account & Multi-User Access Architecture

## 🏢 Company Account Management System

### Overview
The AutoMediaCenter authentication system handles three distinct user types with sophisticated company account management for enterprise clients like BMW, BYD, Mercedes, etc.

## 🎯 Three-Level Access Control System

### Level 1 - Public Users (Journalists, Content Creators)
- **Who:** Journalists, bloggers, content creators, general public
- **Access:** Read-only access to published press releases and public content
- **Registration:** Simple email signup, no company affiliation required
- **Use Cases:** 
  - Download press releases and media assets
  - Access public automotive content
  - Subscribe to brand updates
- **Data Collection:** Basic analytics, content preferences, download history

### Level 2 - Client Users (Company Employees)
- **Who:** BMW employees, BYD staff, Mercedes team members, automotive company staff
- **Access:** Upload assets, manage company content, create press releases
- **Registration:** Must provide company email domain (@bmw.com, @byd.com, etc.)
- **Company Linking:** Automatically linked to company account via email domain verification
- **Permissions:** 
  - Can only see/edit their own company's content
  - Upload media assets for their company
  - Create and manage press releases
  - Access company-specific analytics
- **Company Roles:**
  - **Company Admin:** First user from company, can invite team members, approve content
  - **Regular Company User:** Can upload and manage content, requires admin approval for publishing

### Level 3 - Admin Users (AMC Platform Staff)
- **Who:** AutoMediaCenter staff, platform administrators
- **Access:** Full platform access, user management, all company data
- **Registration:** Manually granted by existing Level 3 admins
- **Use Cases:**
  - Manage all users across all companies
  - Moderate content and approve publications
  - Platform administration and analytics
  - Company account setup and management

## 🏗️ Company Account Structure

### Company Registration Flow

#### Scenario 1: First Company User (BMW Example)
```
1. User: hans.mueller@bmw.com registers
2. System detects: @bmw.com domain not in system
3. System creates:
   - New Company: BMW
   - clientId: "bmw_germany_001"
   - Domain: "@bmw.com"
   - Company Admin: hans.mueller@bmw.com
4. Hans gets Level 2 + Company Admin privileges
5. Hans can now invite other BMW team members
```

#### Scenario 2: Additional Company User
```
1. User: maria.schmidt@bmw.com registers
2. System detects: @bmw.com domain exists (BMW company found)
3. System links Maria to existing BMW account
4. Maria gets Level 2 access to BMW content only
5. Hans (Company Admin) receives notification of new team member
6. Hans can approve Maria's access and set her permissions
```

#### Scenario 3: Public User (Journalist)
```
1. User: john.doe@automotive-news.com registers
2. System detects: Not a registered company domain
3. User selects "Public/Journalist Account"
4. John gets Level 1 (public) access to all published content
5. No company affiliation, can access all public releases
```

## 🔧 Company Management Features

### Company Admin Capabilities
- **Team Management:** Invite colleagues via email
- **Content Approval:** Review and approve content before publication
- **Brand Guidelines:** Set company-specific upload guidelines
- **Analytics Access:** View company-specific download and engagement metrics
- **User Permissions:** Manage what team members can do

### Content Isolation System
- **BMW users** only see BMW content in their dashboard
- **BYD users** only see BYD content in their dashboard
- **Public users** see all published content from all companies
- **Admin users** see everything across all companies

### Company Invitation System
```javascript
Company Admin Flow:
1. Hans (BMW Admin) goes to "Team Management"
2. Enters email: thomas.weber@bmw.com
3. System sends invitation email to Thomas
4. Thomas clicks link, completes registration
5. Thomas automatically gets BMW Level 2 access
6. Hans can set Thomas's specific permissions
```

## 📊 Data Architecture

### Company Model
```javascript
{
  _id: ObjectId,
  companyName: "BMW Group",
  clientId: "bmw_germany_001",
  domain: "@bmw.com",
  companyAdmin: ObjectId (user ID),
  teamMembers: [ObjectId array],
  subscriptionTier: "enterprise",
  brandGuidelines: {...},
  createdAt: Date,
  isActive: true
}
```

### Enhanced User Model
```javascript
{
  _id: ObjectId,
  email: "hans.mueller@bmw.com",
  level: 2,
  role: "company_admin",
  companyId: ObjectId,
  permissions: {
    canInviteUsers: true,
    canApproveContent: true,
    canAccessAnalytics: true,
    canManageTeam: true
  },
  companyRole: "Marketing Director",
  department: "Corporate Communications"
}
```

## 🚀 Implementation Status

### ✅ Completed Components
- Three-level user authentication system
- Company domain detection and linking
- User registration with company affiliation
- Basic company account structure
- Content isolation framework
- Analytics tracking for all user types

### 🔄 Next Implementation Steps
1. **Company Management Dashboard** - Interface for company admins
2. **Team Invitation System** - Email-based team member invitations
3. **Content Approval Workflow** - Company admin approval before publishing
4. **Company-Specific Analytics** - Detailed metrics per company
5. **Brand Guidelines Management** - Company-specific upload rules

## 🎯 User Experience Flow

### For Company Admins (BMW Marketing Director)
1. Login → Company Dashboard
2. See BMW-only content and team management
3. Invite team members via email
4. Approve content before it goes live
5. View BMW-specific analytics and downloads

### For Company Users (BMW Press Officer)
1. Login → BMW Content Dashboard
2. Upload press releases and media assets
3. Create drafts (requires admin approval)
4. Manage existing BMW content
5. Cannot see other companies' content

### For Public Users (Automotive Journalist)
1. Login → Public Content Feed
2. Browse all published press releases
3. Download media assets from all companies
4. Subscribe to specific brands or topics
5. Access public automotive content library

This architecture ensures proper content isolation, company management, and scalable multi-user access while maintaining security and data privacy for each automotive company using the platform.