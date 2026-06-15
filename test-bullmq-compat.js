const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

async function testCompatibility() {
    console.log('🔍 Testing BullMQ Compatibility...\n');
    
    // Test 1: Check versions
    console.log('1. Checking versions:');
    const packageJson = require('./package.json');
    console.log(`   BullMQ version: ${packageJson.dependencies.bullmq || 'not installed'}`);
    console.log(`   ioredis version: ${packageJson.dependencies.ioredis || 'not installed'}`);
    
    // Test 2: Create Redis connection
    console.log('\n2. Testing Redis connection...');
    const redis = new Redis({
        host: '127.0.0.1',
        port: 6379,
        connectTimeout: 5000
    });
    
    try {
        await redis.ping();
        console.log('   ✅ Redis connection successful');
    } catch (err) {
        console.log('   ❌ Redis connection failed:', err.message);
        process.exit(1);
    }
    
    // Test 3: Create a test queue
    console.log('\n3. Testing BullMQ queue creation...');
    try {
        const testQueue = new Queue('test-queue', { connection: redis });
        await testQueue.add('test', { data: 'test' });
        console.log('   ✅ Queue created and job added');
        
        // Test 4: Create worker
        console.log('\n4. Testing worker creation...');
        const worker = new Worker('test-queue', async (job) => {
            console.log('   ✅ Worker processed job:', job.data);
            return 'success';
        }, { connection: redis });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Cleanup
        await worker.close();
        await testQueue.close();
        await redis.quit();
        
        console.log('\n✅ ALL TESTS PASSED! BullMQ is compatible.');
        console.log('Your setup is ready to go!');
        
    } catch (err) {
        console.log('   ❌ BullMQ test failed:', err.message);
        console.log('\n📋 Recommended fix:');
        console.log('   npm uninstall bullmq ioredis');
        console.log('   npm install bullmq@4.14.0 ioredis@5.3.2');
    }
}

testCompatibility().catch(console.error);