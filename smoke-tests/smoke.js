const fetch = require('node-fetch').default;
const fs = require('fs').promises;
const path = require('path');
const { auditLogger } = require('../src/utils/logger');

const BASE_URL = process.env.BASE_URL || 'http://localhost:39772';
const TEST_EMPLOYEE_ID = process.env.TEST_EMPLOYEE_ID || 'EMP001';
const TEST_HR_ID = process.env.TEST_HR_ID || 'HR001';
const TEST_ADMIN_ID = process.env.TEST_ADMIN_ID || 'ADMIN001';
let TEST_PASSWORD = process.env.TEST_PASSWORD;

class SmokeTester {
  constructor() {
    this.results = [];
    this.authTokens = {};
    this.testConfig = {};
  }

  async loadTestCredentials() {
    try {
      const credentialsPath = path.join(__dirname, '.test-credentials.json');
      
      if (process.env.NODE_ENV === 'development' && await fs.access(credentialsPath).then(() => true).catch(() => false)) {
        const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
        TEST_PASSWORD = credentials.testPassword || process.env.TEST_PASSWORD;
        
        if (!TEST_PASSWORD) {
          throw new Error('Test password not found. Set TEST_PASSWORD env variable or create .test-credentials.json');
        }
        
        auditLogger.info('Loaded test credentials from secure file', {
          file: credentialsPath,
          hasPassword: !!TEST_PASSWORD
        });
      } else if (!TEST_PASSWORD) {
        console.warn('⚠️  WARNING: Using default test password. In production, use environment variables.');
        TEST_PASSWORD = process.env.TEST_PASSWORD || 'temp_secure_pass_' + Date.now();
      }
      
      this.testConfig = {
        employee: { id: TEST_EMPLOYEE_ID, password: TEST_PASSWORD },
        hr: { id: TEST_HR_ID, password: TEST_PASSWORD },
        admin: { id: TEST_ADMIN_ID, password: TEST_PASSWORD }
      };
      
    } catch (error) {
      auditLogger.error('Failed to load test credentials', { error: error.message });
      throw error;
    }
  }

  async makeRequest(url, options = {}) {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          ...options.headers
        },
        timeout: 10000
      });
      
      const responseTime = Date.now() - startTime;
      const responseData = await response.json().catch(() => ({}));
      
      auditLogger.info('API Request', {
        requestId,
        url,
        method: options.method || 'GET',
        status: response.status,
        responseTime: `${responseTime}ms`,
        success: response.ok
      });
      
      return {
        status: response.status,
        ok: response.ok,
        data: responseData,
        headers: response.headers,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      auditLogger.error('API Request Failed', {
        requestId,
        url,
        method: options.method || 'GET',
        error: error.message,
        responseTime: `${responseTime}ms`
      });
      
      throw error;
    }
  }

  async testEndpoint(name, url, options = {}) {
    console.log(`\n🔍 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    
    try {
      const result = await this.makeRequest(url, options);
      
      this.results.push({
        name,
        success: result.ok,
        status: result.status,
        responseTime: result.responseTime,
        timestamp: new Date().toISOString()
      });
      
      if (result.ok) {
        console.log(`   ✅ SUCCESS (${result.status}) - ${result.responseTime}ms`);
        
        if (result.data) {
          const safeData = this.sanitizeResponseData(result.data);
          console.log(`   Response: ${JSON.stringify(safeData).substring(0, 200)}...`);
        }
      } else {
        console.log(`   ❌ FAILED (${result.status}) - ${result.responseTime}ms`);
        console.log(`   Error: ${JSON.stringify(result.data).substring(0, 200)}`);
      }
      
      return result;
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
      
      this.results.push({
        name,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  sanitizeResponseData(data) {
    const sanitized = { ...data };
    
    if (sanitized.token) {
      sanitized.token = `[JWT_TOKEN_${sanitized.token.substr(-8)}]`;
    }
    
    if (sanitized.password) {
      sanitized.password = '[REDACTED]';
    }
    
    if (sanitized.user && sanitized.user.password) {
      sanitized.user.password = '[REDACTED]';
    }
    
    return sanitized;
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Smoke Tests');
    console.log('====================================');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('====================================\n');
    
    await this.loadTestCredentials();
    
    try {
      await this.testEndpoint('Ping Endpoint', `${BASE_URL}/ping`);
      await this.testEndpoint('Health Check', `${BASE_URL}/api/health`);
      
      const employeeLogin = await this.testEndpoint('Employee Login', `${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: this.testConfig.employee.id,
          password: this.testConfig.employee.password
        })
      });
      
      if (employeeLogin.ok && employeeLogin.data.token) {
        this.authTokens.employee = employeeLogin.data.token;
        console.log(`   🔑 Employee token acquired (length: ${employeeLogin.data.token.length})`);
      }
      
      const hrLogin = await this.testEndpoint('HR Login', `${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: this.testConfig.hr.id,
          password: this.testConfig.hr.password
        })
      });
      
      if (hrLogin.ok && hrLogin.data.token) {
        this.authTokens.hr = hrLogin.data.token;
        console.log(`   🔑 HR token acquired (length: ${hrLogin.data.token.length})`);
      }
      
      await this.testEndpoint('Invalid Login (Security Test)', `${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'INVALID_USER',
          password: 'WRONG_PASSWORD'
        })
      });
      
      if (this.authTokens.employee) {
        await this.testEndpoint('Employee Profile', `${BASE_URL}/api/employees/${this.testConfig.employee.id}`, {
          headers: { Authorization: `Bearer ${this.authTokens.employee}` }
        });
        
        await this.testEndpoint('Attendance Today', `${BASE_URL}/api/attendance/today/${this.testConfig.employee.id}`, {
          headers: { Authorization: `Bearer ${this.authTokens.employee}` }
        });
        
        await this.testEndpoint('Leave Balance', `${BASE_URL}/api/leave/balance/${this.testConfig.employee.id}`, {
          headers: { Authorization: `Bearer ${this.authTokens.employee}` }
        });
      }
      
      if (this.authTokens.hr) {
        await this.testEndpoint('HR Dashboard', `${BASE_URL}/api/hr/dashboard`, {
          headers: { Authorization: `Bearer ${this.authTokens.hr}` }
        });
        
        await this.testEndpoint('Pending Leaves', `${BASE_URL}/api/hr/leaves/pending`, {
          headers: { Authorization: `Bearer ${this.authTokens.hr}` }
        });
      }
      
      await this.testEndpoint('Announcements', `${BASE_URL}/api/announcements`);
      await this.testEndpoint('Invalid Endpoint (404 Test)', `${BASE_URL}/api/nonexistent`);
      await this.testEndpoint('Protected Without Token', `${BASE_URL}/api/employees/${this.testConfig.employee.id}`);
      
      console.log('\n⚡ Performance Tests:');
      const perfTests = [];
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await this.makeRequest(`${BASE_URL}/ping`);
        const duration = Date.now() - start;
        perfTests.push(duration);
        console.log(`   Ping ${i + 1}: ${duration}ms`);
      }
      
      const avgPerf = perfTests.reduce((a, b) => a + b, 0) / perfTests.length;
      console.log(`   Average: ${avgPerf.toFixed(2)}ms`);
      
      this.results.push({
        name: 'Performance Average',
        success: avgPerf < 100,
        responseTime: avgPerf,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`\n💥 Test suite failed: ${error.message}`);
      auditLogger.error('Smoke test suite failed', { error: error.message });
    }
    
    await this.generateReport();
  }

  async generateReport() {
    console.log('\n📊 TEST REPORT');
    console.log('==============');
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(2);
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${successRate}%`);
    
    const failures = this.results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log('\n🔴 FAILED TESTS:');
      failures.forEach(f => {
        console.log(`   ❌ ${f.name}: ${f.error || `Status ${f.status}`}`);
      });
    }
    
    const responseTimes = this.results.filter(r => r.responseTime).map(r => r.responseTime);
    if (responseTimes.length > 0) {
      const avgResponse = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponse = Math.max(...responseTimes);
      const minResponse = Math.min(...responseTimes);
      
      console.log('\n⚡ PERFORMANCE ANALYSIS:');
      console.log(`   Average Response: ${avgResponse.toFixed(2)}ms`);
      console.log(`   Fastest: ${minResponse}ms`);
      console.log(`   Slowest: ${maxResponse}ms`);
      
      if (avgResponse > 500) {
        console.log('   ⚠️  WARNING: Average response time is high (>500ms)');
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (successRate < 100) {
      console.log('   1. Investigate failed endpoints');
    }
    
    if (!this.authTokens.employee) {
      console.log('   2. Check authentication service');
    }
    
    if (!this.authTokens.hr) {
      console.log('   3. Verify HR user exists and is active');
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      baseUrl: BASE_URL,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate
      },
      results: this.results,
      performance: responseTimes.length > 0 ? {
        average: avgResponse,
        min: minResponse,
        max: maxResponse
      } : null
    };
    
    try {
      const reportDir = path.join(__dirname, '../test-reports');
      await fs.mkdir(reportDir, { recursive: true });
      
      const reportFile = path.join(reportDir, `smoke-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
      
      console.log(`\n📁 Report saved to: ${reportFile}`);
      
      auditLogger.info('Smoke tests completed', {
        totalTests,
        passedTests,
        failedTests,
        successRate: `${successRate}%`,
        reportFile
      });
      
    } catch (error) {
      console.error('Failed to save report:', error.message);
    }
    
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

async function createCredentialsTemplate() {
  const templatePath = path.join(__dirname, '.test-credentials.example.json');
  const template = {
    testPassword: "your_secure_test_password_here",
    note: "This file should be created as .test-credentials.json and added to .gitignore"
  };
  
  if (!await fs.access(templatePath).then(() => true).catch(() => false)) {
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
    console.log('Created credentials template:', templatePath);
  }
}

(async () => {
  try {
    await createCredentialsTemplate();
    
    const tester = new SmokeTester();
    await tester.runAllTests();
    
  } catch (error) {
    console.error('Fatal error in smoke tests:', error);
    auditLogger.error('Smoke tests fatal error', { error: error.message });
    process.exit(1);
  }
})();