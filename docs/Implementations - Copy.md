Secure AI Agent for Automated Technical Support Email Processing using Microsoft Copilot Retrieval API

Implementations

1 Frontend Implementation
•	Built using React.js
•	Dashboard for admin monitoring
•	User management interface
•	Email and ticket display
•	API integration using Axios

2 Backend Implementation
API Layer:
•	Developed using FastAPI
•	REST endpoints for:
o	User management
o	Email processing
o	Logs and monitoring

AI Agent Implementation:
•	Built using LangGraph
•	Workflow includes:
o	Email parsing
o	Security detection
o	Knowledge retrieval
o	Response generation
o	Escalation

Security Implementation:
•	Spam detection (keyword + ML)
•	Phishing detection (URL/domain analysis)
•	Prompt injection detection (rule-based + AI)

Knowledge Retrieval:
•	Integrated Microsoft Copilot Retrieval API
•	Fetches data from SharePoint knowledge base

Database Implementation:
•	PostgreSQL used
•	Stores:
o	Users
o	Emails
o	Tickets
o	Responses
o	Logs

Authentication & Authorization:
•	Role-Based Access Control (RBAC)
•	Admin and user roles
•	JWT-based authentication
