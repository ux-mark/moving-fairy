# MCP Server

The MCP server is a separate Fly.io app. It lives here during development and will be extracted to its own repository before deployment.

All database access from the Next.js app goes through this server — no direct Supabase calls from app code except for Auth and Storage uploads.
