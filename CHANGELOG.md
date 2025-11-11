# Changelog

All notable changes to the Luci Digital fork of Metabase MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-11-11

### Added

#### Documentation Enhancements
- **Comprehensive Observability Documentation** (2,894 lines)
  - `OBSERVABILITY-INDEX.md` - Navigation guide for observability features
  - `OBSERVABILITY-SUMMARY.md` - Executive overview with key findings and recommendations
  - `OBSERVABILITY-ANALYSIS.md` - Deep technical analysis with 16 sections and 30+ enhancement opportunities
  - `OBSERVABILITY-IMPLEMENTATION-GUIDE.md` - Step-by-step implementation guide with code examples
  - `OBSERVABILITY-CHECKLIST.md` - 58-item assessment checklist with 5-week implementation roadmap
  - Patterns extracted from Prometheus/Grafana/monitoring MCP servers
  - Zero external dependencies approach (pure TypeScript/Node.js)

- **Benefits Guide for Stakeholders** (`BENEFITS-GUIDE.md`, 906 lines)
  - Human-friendly explanation of AI agent enhancements
  - Real-world before/after scenarios demonstrating 10-20x speedups
  - Use cases for executives, product managers, marketing, customer success, and operations teams
  - Success stories with measurable ROI (18% conversion improvement, 16 hours/week saved)
  - ROI measurement framework
  - Common questions and answers for decision makers

- **Enhanced Agent Documentation**
  - Personal AI Container integration architecture
  - Swift Container Plugin integration patterns
  - Enhanced agent communication patterns and security models
  - Carbon-based authentication and domain isolation models

#### Repository Updates
- Proper attribution to original creator Jericho Sequitin throughout all documentation
- Updated repository references from `jerichosequitin/metabase-mcp` to `luci-digital/luci-metabase-mcp`
- Comprehensive Acknowledgments section in README
- Project Lineage section clarifying fork relationship
- Updated manifest.json with Luci Digital attribution while crediting original creator

#### Code Standards
- Removed emoji usage from documentation and scripts to comply with CLAUDE.md standards
  - Updated `.husky/pre-commit`
  - Updated `scripts/test-all.sh`
  - Updated 4 documentation files

#### Build System
- Updated to MCPB (MCP Bundle) packaging format (from DXT)
- Manifest version updated to 0.3
- Updated build documentation and terminology

### Changed

- **Version**: Bumped from 1.0.0 to 1.0.1
- **Badge**: Switched from Smithery to Ask DeepWiki
- **Terminology**: Migrated from DXT (Desktop Extension) to MCPB (MCP Bundle)
- **Package Format**: Release file extension changed from `.dxt` to `.mcpb`
- **Author Attribution**: Enhanced to "Luci Digital (Original: Jericho Sequitin)"
- **Long Description**: Added mention of Luci Digital enhancements

### Maintained from Original (v1.0.0)

All core functionality from Jericho Sequitin's original implementation:
- Core MCP server architecture and tool implementation
- Response optimization achieving 80-90% token reduction
- Multi-layer caching system with intelligent TTL management
- Dual authentication support (API key and email/password)
- Large dataset export capabilities (CSV, JSON, XLSX)
- Comprehensive error handling with agent guidance
- Production-ready testing infrastructure (235 tests, 80% coverage)
- All 6 MCP tools: `search`, `list`, `retrieve`, `execute`, `export`, `clear_cache`
- Concurrent processing with controlled batch sizes
- Pagination support for large datasets
- Configurable export directory with environment variable expansion

### Repository

- **Current**: https://github.com/luci-digital/luci-metabase-mcp
- **Original**: https://github.com/jerichosequitin/metabase-mcp

## [1.0.0] - Original Release by Jericho Sequitin

### Original Features

- High-performance MCP server for Metabase analytics
- Intelligent caching with configurable TTL
- Response optimization (75-90% token reduction)
- Unified command interface
- Multiple authentication methods
- Comprehensive toolset
- Production-ready testing
- Docker support
- Desktop Extension (DXT) packaging

### Original Tools

- **search**: Unified search across all Metabase items
- **list**: Fetch all records for a resource type with pagination
- **retrieve**: Get detailed information with concurrent processing
- **execute**: Execute SQL queries or saved cards (2K row limit)
- **export**: Export large datasets up to 1M rows (CSV/JSON/XLSX)
- **clear_cache**: Granular cache management

### Original Author

Created by **Jericho Sequitin** ([@jerichosequitin](https://github.com/jerichosequitin))

---

## Attribution

This project is a fork of Jericho Sequitin's original Metabase MCP Server. All core functionality, architecture, and innovation credit belongs to the original creator. Luci Digital enhancements focus on enterprise observability, comprehensive documentation, and advanced deployment patterns.

**Original Repository**: https://github.com/jerichosequitin/metabase-mcp

**Enhanced Fork**: https://github.com/luci-digital/luci-metabase-mcp
