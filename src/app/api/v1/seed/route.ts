import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { hashPassword } from '@/lib/password';

// Shared password for every seeded demo account. This is a local/pilot
// sandbox convenience, not a secret — do not seed these accounts (or reuse
// this password) against a database that holds real user data.
const DEMO_PASSWORD = 'Rezzo@Demo123';

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    // Dynamic import of the seed script
    // We re-implement the seed inline since the seed.ts uses a different db instance
    const { db } = await import('@/lib/db');

    console.log('🌱 Running seed via API...');

    // Clear tables in order
    const clearTables = [
      'auditLog', 'notification', 'aiToolCall', 'aiJob', 'dispute', 'review',
      'message', 'documentPermission', 'document', 'proofItem', 'milestone',
      'commissionEntry', 'payout', 'payment', 'booking', 'quote', 'servicePrice', 'service',
      'verificationReview', 'professionalSkill', 'professionalCredential',
      'followUp', 'protectionBenefit', 'bypassSignal', 'communicationEvent',
      'professional', 'caseParticipant', 'caseEvent', 'case', 'matter', 'need',
      'profile', 'subscription', 'user', 'knowledgeSource',
    ];

    for (const table of clearTables) {
      await (db as Record<string, { deleteMany: () => Promise<unknown> }>)[table].deleteMany();
    }

    // ============ CUSTOMER USERS ============
    const customer1 = await db.user.create({
      data: { phone: '+2348012345678', password: hashPassword(DEMO_PASSWORD), role: 'CUSTOMER', status: 'ACTIVE' },
    });
    await db.profile.create({
      data: {
        userId: customer1.id, displayName: 'Adebayo Okonkwo',
        location: 'Lagos', state: 'Lagos',
        preferences: { language: 'en', notifications: true },
      },
    });

    const customer2 = await db.user.create({
      data: { phone: '+2348023456789', password: hashPassword(DEMO_PASSWORD), role: 'CUSTOMER', status: 'ACTIVE' },
    });
    await db.profile.create({
      data: {
        userId: customer2.id, displayName: 'Chioma Eze',
        location: 'Abuja', state: 'FCT',
        preferences: { language: 'en', notifications: true },
      },
    });

    const customer3 = await db.user.create({
      data: { phone: '+2348034567890', password: hashPassword(DEMO_PASSWORD), role: 'CUSTOMER', status: 'ACTIVE' },
    });
    await db.profile.create({
      data: {
        userId: customer3.id, displayName: 'Ibrahim Musa',
        location: 'Ogun', state: 'Ogun',
        preferences: { language: 'en', notifications: true },
      },
    });

    // ============ PROFESSIONAL 1: AC Repair ============
    const proUser1 = await db.user.create({
      data: { phone: '+2348055511111', email: 'tunde@rezzo.ng', password: hashPassword(DEMO_PASSWORD), role: 'PROFESSIONAL', status: 'ACTIVE' },
    });
    await db.profile.create({
      data: { userId: proUser1.id, displayName: 'Tunde Bakare', location: 'Lagos', state: 'Lagos', preferences: { language: 'en' } },
    });
    const pro1 = await db.professional.create({
      data: {
        userId: proUser1.id,
        bio: 'Certified HVAC technician with 8 years of experience in AC repair, installation, and maintenance.',
        serviceArea: 'Lagos', availabilityStatus: 'ACTIVE', trustScore: 85, verificationStatus: 'VERIFIED',
      },
    });
    await db.professionalCredential.createMany({
      data: [
        { professionalId: pro1.id, type: 'IDENTITY', issuer: 'NIN', reference: 'NIN-001-AC', status: 'VERIFIED' },
        { professionalId: pro1.id, type: 'LICENSE', issuer: 'LASEPA', reference: 'HVAC-LAG-2024-001', status: 'VERIFIED' },
      ],
    });
    await db.professionalSkill.createMany({
      data: [
        { professionalId: pro1.id, name: 'AC repair', level: 'EXPERT', categoryId: 'HOME_TECHNICAL' },
        { professionalId: pro1.id, name: 'AC installation', level: 'ADVANCED', categoryId: 'HOME_TECHNICAL' },
        { professionalId: pro1.id, name: 'HVAC diagnostics', level: 'EXPERT', categoryId: 'HOME_TECHNICAL' },
        { professionalId: pro1.id, name: 'Refrigerant handling', level: 'ADVANCED', categoryId: 'HOME_TECHNICAL' },
      ],
    });
    await db.service.create({
      data: {
        professionalId: pro1.id, categoryId: 'HOME_TECHNICAL',
        name: 'AC Repair & Diagnostics', description: 'Complete AC repair, diagnostics, gas refill, and maintenance',
        pricingType: 'QUOTE_REQUIRED', active: true,
      },
    });

    // ============ PROFESSIONAL 2: Generator Repair ============
    const proUser2 = await db.user.create({
      data: { phone: '+2348055522222', email: 'emeka@rezzo.ng', password: hashPassword(DEMO_PASSWORD), role: 'PROFESSIONAL', status: 'ACTIVE' },
    });
    await db.profile.create({
      data: { userId: proUser2.id, displayName: 'Emeka Nwosu', location: 'Lagos', state: 'Lagos', preferences: { language: 'en' } },
    });
    const pro2 = await db.professional.create({
      data: {
        userId: proUser2.id,
        bio: 'Licensed electrical engineer specializing in generator repair, installation, and power systems. 12 years experience.',
        serviceArea: 'Lagos, Ogun', availabilityStatus: 'ACTIVE', trustScore: 92, verificationStatus: 'TRUSTED',
      },
    });
    await db.professionalCredential.createMany({
      data: [
        { professionalId: pro2.id, type: 'IDENTITY', issuer: 'NIN', reference: 'NIN-002-GEN', status: 'VERIFIED' },
        { professionalId: pro2.id, type: 'LICENSE', issuer: 'COREN', reference: 'ENG-COREN-2022-045', status: 'VERIFIED' },
      ],
    });
    await db.professionalSkill.createMany({
      data: [
        { professionalId: pro2.id, name: 'Generator repair', level: 'EXPERT', categoryId: 'HOME_TECHNICAL' },
        { professionalId: pro2.id, name: 'Electrical systems', level: 'EXPERT', categoryId: 'HOME_TECHNICAL' },
        { professionalId: pro2.id, name: 'Generator installation', level: 'ADVANCED', categoryId: 'HOME_TECHNICAL' },
        { professionalId: pro2.id, name: 'Inverter systems', level: 'INTERMEDIATE', categoryId: 'HOME_TECHNICAL' },
      ],
    });
    const pro2Svc = await db.service.create({
      data: {
        professionalId: pro2.id, categoryId: 'HOME_TECHNICAL',
        name: 'Generator Diagnostic', description: 'Full diagnostic to identify generator issues',
        pricingType: 'FIXED', active: true,
      },
    });
    await db.servicePrice.create({
      data: { serviceId: pro2Svc.id, amount: 10000, currency: 'NGN', unit: 'flat' },
    });
    await db.service.create({
      data: {
        professionalId: pro2.id, categoryId: 'HOME_TECHNICAL',
        name: 'Generator Repair', description: 'Complete generator repair including parts and labor',
        pricingType: 'QUOTE_REQUIRED', active: true,
      },
    });

    // ============ PROFESSIONAL 3: Plumbing ============
    const proUser3 = await db.user.create({
      data: { phone: '+2348055533333', email: 'bola@rezzo.ng', password: hashPassword(DEMO_PASSWORD), role: 'PROFESSIONAL', status: 'ACTIVE' },
    });
    await db.profile.create({
      data: { userId: proUser3.id, displayName: 'Bola Adeyemi', location: 'Abuja', state: 'FCT', preferences: { language: 'en' } },
    });
    const pro3 = await db.professional.create({
      data: {
        userId: proUser3.id,
        bio: 'Multi-trade technician specializing in plumbing and basic electrical work. 5 years experience.',
        serviceArea: 'Abuja', availabilityStatus: 'ACTIVE', trustScore: 78, verificationStatus: 'VERIFIED',
      },
    });
    await db.professionalCredential.createMany({
      data: [
        { professionalId: pro3.id, type: 'IDENTITY', issuer: 'NIN', reference: 'NIN-003-PLM', status: 'VERIFIED' },
        { professionalId: pro3.id, type: 'CERTIFICATE', issuer: 'ITF', reference: 'ITF-PLMB-2023-078', status: 'VERIFIED' },
      ],
    });
    await db.professionalSkill.createMany({
      data: [
        { professionalId: pro3.id, name: 'Plumbing', level: 'ADVANCED', categoryId: 'HOME_TECHNICAL' },
        { professionalId: pro3.id, name: 'Electrical repair', level: 'INTERMEDIATE', categoryId: 'HOME_TECHNICAL' },
        { professionalId: pro3.id, name: 'Pipe fitting', level: 'ADVANCED', categoryId: 'HOME_TECHNICAL' },
      ],
    });
    await db.service.create({
      data: {
        professionalId: pro3.id, categoryId: 'HOME_TECHNICAL',
        name: 'Plumbing Service', description: 'Residential and commercial plumbing repair, installation, and maintenance',
        pricingType: 'QUOTE_REQUIRED', active: true,
      },
    });

    // ============ ADMIN ============
    const admin = await db.user.create({
      data: { email: 'admin@rezzo.ng', password: hashPassword(DEMO_PASSWORD), role: 'ADMIN', status: 'ACTIVE' },
    });
    await db.profile.create({
      data: { userId: admin.id, displayName: 'REZZO Admin', preferences: { language: 'en' } },
    });

    // ============ KNOWLEDGE SOURCES ============
    await db.knowledgeSource.createMany({
      data: [
        {
          category: 'HOME_TECHNICAL', authorityLevel: 'A',
          title: 'Nigeria Electrical Safety Standards',
          url: 'https://example.gov.ng/electrical-safety',
          contentJson: { summary: 'National electrical safety codes for Nigerian buildings', source: 'Federal Ministry of Power', applicableTo: ['ELECTRICAL'] },
          active: true,
        },
        {
          category: 'HOME_TECHNICAL', authorityLevel: 'B',
          title: 'HVAC Best Practices for Nigerian Climate',
          url: 'https://example.org/hvac-nigeria',
          contentJson: { summary: 'Recommended HVAC practices for tropical climate zones', source: 'Nigeria HVAC Association', applicableTo: ['AC_REPAIR'] },
          active: true,
        },
        {
          category: 'HOME_TECHNICAL', authorityLevel: 'B',
          title: 'Plumbing Code of Practice - Nigeria',
          url: 'https://example.org/plumbing-code',
          contentJson: { summary: 'Standard plumbing practices for Nigerian buildings', source: 'Nigeria Society of Engineers', applicableTo: ['PLUMBING'] },
          active: true,
        },
        {
          category: 'HOME_TECHNICAL', authorityLevel: 'A',
          title: 'Generator Installation Guidelines',
          url: 'https://example.gov.ng/generator-safety',
          contentJson: { summary: 'Safety guidelines for backup generators', source: 'NEMA', applicableTo: ['GENERATOR_REPAIR'] },
          active: true,
        },
        {
          category: 'PROPERTY_HOUSING', authorityLevel: 'A',
          title: 'Lagos Tenancy Law 2011',
          url: 'https://example.gov.ng/lagos-tenancy',
          contentJson: { summary: 'Tenancy law for Lagos State', source: 'Lagos State Government', applicableTo: ['PROPERTY_HOUSING'] },
          active: true,
        },
      ],
    });

    // ============ SAMPLE CASE ============
    const sampleNeed = await db.need.create({
      data: {
        userId: customer1.id,
        title: 'AC not cooling properly',
        rawInput: 'My air conditioner is running but not cooling the room. It was working fine last week. The unit makes a buzzing sound when it starts. I live in Lagos mainland area.',
        desiredOutcome: 'Get my AC working and cooling properly again',
      },
    });
    const sampleCase = await db.case.create({
      data: {
        caseNumber: 'RZ-10000', userId: customer1.id, needId: sampleNeed.id,
        status: 'NEW', location: 'Lagos Mainland', state: 'Lagos', priority: 'NORMAL',
        routeJson: null, resolutionCriteria: null,
      },
    });
    await db.caseParticipant.create({
      data: {
        caseId: sampleCase.id, userId: customer1.id, role: 'CUSTOMER',
        permissions: { canView: true, canMessage: true, canAcceptQuote: true, canDispute: true, canReview: true },
      },
    });
    await db.caseEvent.create({
      data: {
        caseId: sampleCase.id, eventType: 'CASE_CREATED', actorType: 'CUSTOMER', actorId: customer1.id,
        payload: { title: 'AC not cooling properly', caseNumber: 'RZ-10000' },
      },
    });

    return NextResponse.json(successResponse({
      seeded: true,
      customers: [customer1.id, customer2.id, customer3.id],
      professionals: [pro1.id, pro2.id, pro3.id],
      admin: admin.id,
      sampleCase: sampleCase.id,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
