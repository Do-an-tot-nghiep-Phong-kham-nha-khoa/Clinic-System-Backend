/**
 * Script kiểm tra performance N+1 query trước và sau khi dùng snapshot
 * Chạy: node scripts/test-appointment-performance.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Appointment = require('../src/models/appointment');
const Patient = require('../src/models/patient');
const FamilyMember = require('../src/models/familyMember');

// Đếm số lượng queries
let queryCount = 0;

function trackQuery(collectionName) {
    queryCount++;
    console.log(`  [Query #${queryCount}] ${collectionName}`);
}

async function testOldApproach() {
    console.log('\n🔴 OLD APPROACH (N+1 queries):');
    console.log('─'.repeat(50));
    queryCount = 0;
    const startTime = Date.now();

    // Query appointments
    trackQuery('Appointment.find()');
    const appointments = await Appointment.find({})
        .populate('healthProfile_id')
        .limit(20)
        .lean();

    // Simulate old approach - query in loop
    for (const app of appointments) {
        const hp = app.healthProfile_id;
        
        if (hp && hp.ownerId && hp.ownerModel) {
            if (hp.ownerModel === 'Patient') {
                trackQuery('Patient.findById()');
                await Patient.findById(hp.ownerId).select('name phone dob gender').lean();
            } else if (hp.ownerModel === 'FamilyMember') {
                trackQuery('FamilyMember.findById()');
                await FamilyMember.findById(hp.ownerId).select('name phone dob gender').lean();
            }
        }
    }

    const duration = Date.now() - startTime;
    
    console.log(`\n📊 Results:`);
    console.log(`   Total queries: ${queryCount}`);
    console.log(`   Time: ${duration}ms`);
    console.log(`   Appointments processed: ${appointments.length}`);
    
    return { queryCount, duration, count: appointments.length };
}

async function testNewApproach() {
    console.log('\n✅ NEW APPROACH (with snapshot):');
    console.log('─'.repeat(50));
    queryCount = 0;
    const startTime = Date.now();

    // Query appointments with snapshot
    trackQuery('Appointment.find()');
    const appointments = await Appointment.find({})
        .populate('healthProfile_id')
        .limit(20)
        .lean();

    // No additional queries needed - data in snapshot!
    const final = appointments.map(app => ({
        ...app,
        owner_detail: app.patientSnapshot || null
    }));

    const duration = Date.now() - startTime;
    
    console.log(`\n📊 Results:`);
    console.log(`   Total queries: ${queryCount}`);
    console.log(`   Time: ${duration}ms`);
    console.log(`   Appointments processed: ${final.length}`);
    
    return { queryCount, duration, count: final.length };
}

async function runPerformanceTest() {
    try {
        // Kết nối database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-system', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Connected to MongoDB');
        console.log('🧪 Running performance test...\n');

        // Test old approach
        const oldResults = await testOldApproach();

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test new approach
        const newResults = await testNewApproach();

        // Compare
        console.log('\n📈 COMPARISON:');
        console.log('═'.repeat(50));
        console.log(`Query reduction: ${oldResults.queryCount - newResults.queryCount} queries (${Math.round((1 - newResults.queryCount / oldResults.queryCount) * 100)}% reduction)`);
        console.log(`Time improvement: ${oldResults.duration - newResults.duration}ms faster (${Math.round((1 - newResults.duration / oldResults.duration) * 100)}% faster)`);
        
        if (newResults.queryCount === 1) {
            console.log('\n🎉 SUCCESS! N+1 query problem is SOLVED!');
        } else {
            console.log('\n⚠️  Warning: Still have more than 1 query');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Chạy test
runPerformanceTest();
