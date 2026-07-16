import {
  db,
  stagesTable, gradesTable, subjectsTable, publishersTable, governoratesTable,
  productsTable, usersTable, siteSettingsTable, bannersTable, faqsTable, categoriesTable,
  productImagesTable, citiesTable, customersTable, ordersTable, orderItemsTable,
  orderStatusHistoryTable, stockMovementsTable, couponsTable, auditLogsTable,
  addressesTable, favoritesTable,
  classificationOptionsTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_DEMO_SEED !== "true") throw new Error("Demo seed is disabled in production. Use the one-time admin bootstrap command instead.");
  console.log("🌱 Starting seed...");

  // Stages
  const stagesData = [
    { nameAr: "ابتدائي", nameEn: "Primary", sortOrder: 1 },
    { nameAr: "إعدادي", nameEn: "Preparatory", sortOrder: 2 },
    { nameAr: "ثانوي", nameEn: "Secondary", sortOrder: 3 },
    { nameAr: "أزهر", nameEn: "Al-Azhar", sortOrder: 4 },
  ];
  const existingStages = await db.select().from(stagesTable);
  const stages = existingStages.length ? existingStages : await db.insert(stagesTable).values(stagesData).returning();
  console.log(`✅ ${stages.length} stages`);

  // Grades
  const gradesData = [
    // Primary (stage 1)
    { nameAr: "الأول الابتدائي", stageId: stages[0]?.id || 1, sortOrder: 1 },
    { nameAr: "الثاني الابتدائي", stageId: stages[0]?.id || 1, sortOrder: 2 },
    { nameAr: "الثالث الابتدائي", stageId: stages[0]?.id || 1, sortOrder: 3 },
    { nameAr: "الرابع الابتدائي", stageId: stages[0]?.id || 1, sortOrder: 4 },
    { nameAr: "الخامس الابتدائي", stageId: stages[0]?.id || 1, sortOrder: 5 },
    { nameAr: "السادس الابتدائي", stageId: stages[0]?.id || 1, sortOrder: 6 },
    // Preparatory (stage 2)
    { nameAr: "الأول الإعدادي", stageId: stages[1]?.id || 2, sortOrder: 1 },
    { nameAr: "الثاني الإعدادي", stageId: stages[1]?.id || 2, sortOrder: 2 },
    { nameAr: "الثالث الإعدادي", stageId: stages[1]?.id || 2, sortOrder: 3 },
    // Secondary (stage 3)
    { nameAr: "الأول الثانوي", stageId: stages[2]?.id || 3, sortOrder: 1 },
    { nameAr: "الثاني الثانوي", stageId: stages[2]?.id || 3, sortOrder: 2 },
    { nameAr: "الثالث الثانوي", stageId: stages[2]?.id || 3, sortOrder: 3 },
  ];
  const existingGrades = await db.select().from(gradesTable);
  const grades = existingGrades.length ? existingGrades : await db.insert(gradesTable).values(gradesData).returning();
  console.log(`✅ ${grades.length} grades`);

  // Subjects
  const subjectsData = [
    { nameAr: "اللغة العربية", nameEn: "Arabic" },
    { nameAr: "الرياضيات", nameEn: "Math" },
    { nameAr: "العلوم", nameEn: "Science" },
    { nameAr: "اللغة الإنجليزية", nameEn: "English" },
    { nameAr: "الدراسات الاجتماعية", nameEn: "Social Studies" },
    { nameAr: "التربية الدينية", nameEn: "Religious Studies" },
    { nameAr: "الفيزياء", nameEn: "Physics" },
    { nameAr: "الكيمياء", nameEn: "Chemistry" },
    { nameAr: "الأحياء", nameEn: "Biology" },
    { nameAr: "التاريخ", nameEn: "History" },
    { nameAr: "الجغرافيا", nameEn: "Geography" },
    { nameAr: "الفرنسية", nameEn: "French" },
  ];
  const existingSubjects = await db.select().from(subjectsTable);
  const subjects = existingSubjects.length ? existingSubjects : await db.insert(subjectsTable).values(subjectsData).returning();
  console.log(`✅ ${subjects.length} subjects`);

  // Publishers
  const publishersData = [
    { nameAr: "كيان للنشر والتوزيع", nameEn: "Kayan" },
    { nameAr: "الإبداع للنشر", nameEn: "Al-Ibdaa" },
    { nameAr: "نيوتن للنشر", nameEn: "Newton" },
    { nameAr: "المعاصر للنشر", nameEn: "Al-Moaser" },
    { nameAr: "الطالب الناجح", nameEn: "Al-Taleb Al-Nageh" },
    { nameAr: "أكاديمية التعليم", nameEn: "Education Academy" },
    { nameAr: "مكتبة مصر", nameEn: "Maktabet Misr" },
    { nameAr: "دار القلم", nameEn: "Dar Al-Qalam" },
  ];
  const existingPublishers = await db.select().from(publishersTable);
  const publishers = existingPublishers.length ? existingPublishers : await db.insert(publishersTable).values(publishersData).returning();
  console.log(`✅ ${publishers.length} publishers`);

  // Governorates
  const governoratesData = [
    { nameAr: "القاهرة", nameEn: "Cairo", shippingCost: "35", estimatedDays: 2, minDeliveryDays: 1, maxDeliveryDays: 2 },
    { nameAr: "الجيزة", nameEn: "Giza", shippingCost: "35", estimatedDays: 2, minDeliveryDays: 1, maxDeliveryDays: 2 },
    { nameAr: "الإسكندرية", nameEn: "Alexandria", shippingCost: "45", estimatedDays: 2 },
    { nameAr: "الدقهلية", nameEn: "Dakahlia", shippingCost: "45", estimatedDays: 3 },
    { nameAr: "الشرقية", nameEn: "Sharqia", shippingCost: "45", estimatedDays: 3 },
    { nameAr: "القليوبية", nameEn: "Qalyubia", shippingCost: "40", estimatedDays: 2 },
    { nameAr: "الغربية", nameEn: "Gharbia", shippingCost: "45", estimatedDays: 3 },
    { nameAr: "المنوفية", nameEn: "Menoufia", shippingCost: "45", estimatedDays: 3 },
    { nameAr: "البحيرة", nameEn: "Beheira", shippingCost: "50", estimatedDays: 3 },
    { nameAr: "الإسماعيلية", nameEn: "Ismailia", shippingCost: "50", estimatedDays: 3 },
    { nameAr: "السويس", nameEn: "Suez", shippingCost: "55", estimatedDays: 3 },
    { nameAr: "بورسعيد", nameEn: "Port Said", shippingCost: "55", estimatedDays: 3 },
    { nameAr: "كفر الشيخ", nameEn: "Kafr el-Sheikh", shippingCost: "50", estimatedDays: 4 },
    { nameAr: "دمياط", nameEn: "Damietta", shippingCost: "50", estimatedDays: 3 },
    { nameAr: "الفيوم", nameEn: "Fayoum", shippingCost: "55", estimatedDays: 3 },
    { nameAr: "بني سويف", nameEn: "Beni Suef", shippingCost: "55", estimatedDays: 4 },
    { nameAr: "المنيا", nameEn: "Minya", shippingCost: "60", estimatedDays: 4 },
    { nameAr: "أسيوط", nameEn: "Asyut", shippingCost: "65", estimatedDays: 5 },
    { nameAr: "سوهاج", nameEn: "Sohag", shippingCost: "65", estimatedDays: 5 },
    { nameAr: "قنا", nameEn: "Qena", shippingCost: "70", estimatedDays: 5 },
    { nameAr: "الأقصر", nameEn: "Luxor", shippingCost: "70", estimatedDays: 5 },
    { nameAr: "أسوان", nameEn: "Aswan", shippingCost: "75", estimatedDays: 6 },
    { nameAr: "شمال سيناء", nameEn: "North Sinai", shippingCost: "75", estimatedDays: 5 },
    { nameAr: "جنوب سيناء", nameEn: "South Sinai", shippingCost: "80", estimatedDays: 5 },
    { nameAr: "البحر الأحمر", nameEn: "Red Sea", shippingCost: "80", estimatedDays: 6 },
    { nameAr: "مطروح", nameEn: "Matrouh", shippingCost: "80", estimatedDays: 6 },
    { nameAr: "الوادي الجديد", nameEn: "New Valley", shippingCost: "85", estimatedDays: 7 },
  ];
  const existingGovernorates = await db.select().from(governoratesTable);
  const govs = existingGovernorates.length ? existingGovernorates : await db.insert(governoratesTable).values(governoratesData.map(row => ({ ...row, minDeliveryDays: "minDeliveryDays" in row ? row.minDeliveryDays : Math.max(1, row.estimatedDays - 1), maxDeliveryDays: "maxDeliveryDays" in row ? row.maxDeliveryDays : row.estimatedDays }))).returning();
  console.log(`✅ ${govs.length} governorates`);

  // Default admin user
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, "admin@maktaba.com"));
  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash("Admin@2025", 12);
    await db.insert(usersTable).values({
      name: "مدير النظام",
      email: "admin@maktaba.com",
      passwordHash,
      role: "owner",
      permissions: [],
      isActive: true,
    });
    console.log("✅ Development admin fixture created");
  } else {
    console.log("✅ Admin user already exists");
  }

  // Site Settings
  const settingsToInsert = [
    { key: "storeNameAr", value: "مكتبة دوت كوم" },
    { key: "storeName", value: "Maktaba Dot Com" },
    { key: "whatsappNumber", value: "201000000000" },
    { key: "phoneNumber", value: "01000000000" },
    { key: "email", value: "info@maktaba.com" },
    { key: "address", value: "القاهرة، مصر" },
    { key: "facebookUrl", value: "https://facebook.com/maktabadotcom" },
    { key: "instagramUrl", value: "https://instagram.com/maktabadotcom" },
    { key: "tiktokUrl", value: "https://tiktok.com/@maktabadotcom" },
    { key: "announcementBar", value: "🎒 استعداداً للعام الدراسي الجديد — شحن مجاني على الطلبات فوق 500 جنيه للقاهرة والجيزة" },
    { key: "announcementEnabled", value: "true" },
    { key: "announcementLink", value: "/catalog" },
    { key: "announcementStartAt", value: "" },
    { key: "announcementEndAt", value: "" },
    { key: "seoTitle", value: "مكتبة دوت كوم — كتبك التعليمية بين يديك" },
    { key: "seoDescription", value: "متجر الكتب التعليمية الأول في مصر. كتب مدرسية، كتب مراجعة، مناهج لجميع المراحل الدراسية. الدفع عند الاستلام. شحن لكل محافظات مصر." },
  ];
  for (const { key, value } of settingsToInsert) {
    const existing2 = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, key));
    if (existing2.length === 0) {
      await db.insert(siteSettingsTable).values({ key, value });
    }
  }
  console.log("✅ Site settings");

  // Banners
  const bannersCount = await db.select().from(bannersTable);
  if (bannersCount.length === 0) {
    await db.insert(bannersTable).values([
      {
        imageUrl: "https://placehold.co/1200x450/1e3a5f/ffffff?text=مكتبة+دوت+كوم",
        titleAr: "كتبك التعليمية بين يديك",
        subtitleAr: "شحن لكل محافظات مصر — الدفع عند الاستلام",
        badgeText: "اختيارات ذكية لكل طالب",
        primaryButtonText: "ابدأ التصفح",
        primaryButtonUrl: "/catalog",
        secondaryButtonText: "العروض الحالية",
        secondaryButtonUrl: "/offers",
        linkUrl: "/catalog",
        sortOrder: 1,
      },
      {
        imageUrl: "https://placehold.co/1200x450/0ea5e9/ffffff?text=كتب+المراجعة+والتقوية",
        titleAr: "كتب المراجعة والتقوية",
        subtitleAr: "أقوى كتب المراجعة لجميع المراحل الدراسية",
        badgeText: "مراجعة أقوى قبل الامتحان",
        primaryButtonText: "تصفح كتب المراجعة",
        primaryButtonUrl: "/catalog?isRevision=true",
        secondaryButtonText: "كل العروض",
        secondaryButtonUrl: "/offers",
        linkUrl: "/catalog?isRevision=true",
        sortOrder: 2,
      },
      {
        imageUrl: "https://placehold.co/1200x450/d97706/ffffff?text=العودة+للمدارس+2025",
        titleAr: "العودة للمدارس 2025",
        subtitleAr: "المناهج الدراسية الجديدة متاحة الآن",
        badgeText: "استعد للعام الدراسي",
        primaryButtonText: "تصفح الكتب",
        primaryButtonUrl: "/catalog",
        secondaryButtonText: "دور النشر",
        secondaryButtonUrl: "/publishers",
        linkUrl: "/catalog",
        sortOrder: 3,
      },
    ]);
    console.log("✅ Banners");
  }

  // FAQs
  const faqsCount = await db.select().from(faqsTable);
  if (faqsCount.length === 0) {
    await db.insert(faqsTable).values([
      { questionAr: "ما هي مناطق التوصيل؟", answerAr: "نوصل لجميع محافظات مصر. التوصيل داخل القاهرة والجيزة خلال 24-48 ساعة، وباقي المحافظات خلال 3-7 أيام عمل.", sortOrder: 1 },
      { questionAr: "هل يمكن الدفع عند الاستلام؟", answerAr: "نعم، الدفع عند الاستلام متاح لجميع الطلبات في جميع المحافظات. لا نطلب منك أي مبلغ مقدم.", sortOrder: 2 },
      { questionAr: "ما هي سياسة الاستبدال والإرجاع؟", answerAr: "يمكنك إرجاع أو استبدال الكتاب خلال 7 أيام من استلام الطلب إذا كان في حالته الأصلية غير المستخدمة.", sortOrder: 3 },
      { questionAr: "كيف أتتبع طلبي؟", answerAr: "بعد تأكيد طلبك ستصلك رسالة برقم الطلب. يمكنك تتبع الطلب من صفحة التتبع باستخدام رقم الطلب ورقم هاتفك.", sortOrder: 4 },
      { questionAr: "هل الكتب أصلية ومعتمدة؟", answerAr: "جميع الكتب أصلية ومعتمدة من دور النشر الرسمية ومطابقة للمناهج المعتمدة من وزارة التربية والتعليم.", sortOrder: 5 },
      { questionAr: "كيف يمكنني التواصل مع خدمة العملاء؟", answerAr: "يمكنك التواصل معنا عبر واتساب أو الاتصال المباشر من الساعة 9 صباحاً حتى 11 مساءً يومياً.", sortOrder: 6 },
    ]);
    console.log("✅ FAQs");
  }

  // Categories
  const catsCount = await db.select().from(categoriesTable);
  if (catsCount.length === 0) {
    await db.insert(categoriesTable).values([
      { nameAr: "كتب ابتدائي", slug: "primary", sortOrder: 1 },
      { nameAr: "كتب إعدادي", slug: "preparatory", sortOrder: 2 },
      { nameAr: "كتب ثانوي", slug: "secondary", sortOrder: 3 },
      { nameAr: "كتب مراجعة", slug: "revision", sortOrder: 4 },
      { nameAr: "مجموعات", slug: "bundles", sortOrder: 5 },
    ]);
    console.log("✅ Categories");
  }

  // Products
  const productsCount = await db.select().from(productsTable);
  if (productsCount.length < 5) {
    const pubs = await db.select().from(publishersTable);
    const grs = await db.select().from(gradesTable);
    const subs = await db.select().from(subjectsTable);
    const sts = await db.select().from(stagesTable);

    const getSubjectId = (name: string) => subs.find(s => s.nameAr.includes(name))?.id || subs[0]?.id;
    const getPublisherId = (name: string) => pubs.find(p => p.nameAr.includes(name))?.id || pubs[0]?.id;
    const getGradeId = (grade: string) => grs.find(g => g.nameAr.includes(grade))?.id;
    const getStageId = (stage: string) => sts.find(s => s.nameAr.includes(stage))?.id;

    const productsData = [
      // Thanawy
      { nameAr: "منهج الرياضيات — الثالث الثانوي لغات", nameEn: "Math Grade 12 Languages", slug: "math-grade-12-languages", price: "120", oldPrice: "150", stockQuantity: 80, isBestSeller: true, isFeatured: true, isNew: false, gradeId: getGradeId("الثالث الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الرياضيات"), publisherId: getPublisherId("نيوتن"), educationType: "لغات", coverImage: "https://placehold.co/400x550/1e3a5f/ffffff?text=رياضيات+ثانوي" },
      { nameAr: "كيان — الفيزياء للثالث الثانوي", nameEn: "Kayan Physics Grade 12", slug: "kayan-physics-grade-12", price: "95", oldPrice: "120", stockQuantity: 60, isBestSeller: true, isFeatured: true, isRevision: true, gradeId: getGradeId("الثالث الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الفيزياء"), publisherId: getPublisherId("كيان"), educationType: "عربي", coverImage: "https://placehold.co/400x550/0ea5e9/ffffff?text=فيزياء+ثانوي" },
      { nameAr: "المعاصر — اللغة العربية الثالث الثانوي", slug: "moaser-arabic-grade-12", price: "85", stockQuantity: 120, isBestSeller: true, gradeId: getGradeId("الثالث الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("اللغة العربية"), publisherId: getPublisherId("المعاصر"), coverImage: "https://placehold.co/400x550/d97706/ffffff?text=عربي+ثانوي" },
      { nameAr: "نيوتن — الكيمياء للثالث الثانوي", slug: "newton-chemistry-grade-12", price: "90", oldPrice: "110", stockQuantity: 45, isRevision: true, gradeId: getGradeId("الثالث الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الكيمياء"), publisherId: getPublisherId("نيوتن"), educationType: "عربي", coverImage: "https://placehold.co/400x550/16a34a/ffffff?text=كيمياء+ثانوي" },
      { nameAr: "الإبداع — الأحياء للثالث الثانوي", slug: "ibdaa-biology-grade-12", price: "88", stockQuantity: 55, isRevision: false, isBestSeller: true, gradeId: getGradeId("الثالث الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الأحياء"), publisherId: getPublisherId("الإبداع"), coverImage: "https://placehold.co/400x550/7c3aed/ffffff?text=أحياء+ثانوي" },
      { nameAr: "منهج اللغة الإنجليزية الثاني الثانوي", slug: "english-grade-11", price: "75", oldPrice: "90", stockQuantity: 90, isFeatured: true, gradeId: getGradeId("الثاني الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("اللغة الإنجليزية"), publisherId: getPublisherId("كيان"), educationType: "لغات", coverImage: "https://placehold.co/400x550/dc2626/ffffff?text=انجليزي+ثانوي" },
      // Egdadi
      { nameAr: "رياضيات الثالث الإعدادي — كيان", slug: "math-grade-9-kayan", price: "65", oldPrice: "80", stockQuantity: 100, isBestSeller: true, gradeId: getGradeId("الثالث الإعدادي"), stageId: getStageId("إعدادي"), subjectId: getSubjectId("الرياضيات"), publisherId: getPublisherId("كيان"), coverImage: "https://placehold.co/400x550/1e3a5f/ffffff?text=رياضيات+إعدادي" },
      { nameAr: "علوم الثالث الإعدادي — المعاصر", slug: "science-grade-9-moaser", price: "60", stockQuantity: 75, gradeId: getGradeId("الثالث الإعدادي"), stageId: getStageId("إعدادي"), subjectId: getSubjectId("العلوم"), publisherId: getPublisherId("المعاصر"), coverImage: "https://placehold.co/400x550/0ea5e9/ffffff?text=علوم+إعدادي" },
      { nameAr: "اللغة الإنجليزية للثاني الإعدادي", slug: "english-grade-8", price: "55", stockQuantity: 85, isFeatured: true, gradeId: getGradeId("الثاني الإعدادي"), stageId: getStageId("إعدادي"), subjectId: getSubjectId("اللغة الإنجليزية"), publisherId: getPublisherId("نيوتن"), coverImage: "https://placehold.co/400x550/d97706/ffffff?text=انجليزي+إعدادي" },
      { nameAr: "عربي إعدادي — الإبداع للأول الإعدادي", slug: "arabic-grade-7-ibdaa", price: "50", stockQuantity: 60, gradeId: getGradeId("الأول الإعدادي"), stageId: getStageId("إعدادي"), subjectId: getSubjectId("اللغة العربية"), publisherId: getPublisherId("الإبداع"), coverImage: "https://placehold.co/400x550/16a34a/ffffff?text=عربي+إعدادي" },
      // Ebtedayi
      { nameAr: "رياضيات السادس الابتدائي — كيان", slug: "math-grade-6-kayan", price: "45", oldPrice: "55", stockQuantity: 110, isBestSeller: true, gradeId: getGradeId("السادس الابتدائي"), stageId: getStageId("ابتدائي"), subjectId: getSubjectId("الرياضيات"), publisherId: getPublisherId("كيان"), coverImage: "https://placehold.co/400x550/1e3a5f/ffffff?text=رياضيات+ابتدائي" },
      { nameAr: "علوم الخامس الابتدائي", slug: "science-grade-5", price: "40", stockQuantity: 95, gradeId: getGradeId("الخامس الابتدائي"), stageId: getStageId("ابتدائي"), subjectId: getSubjectId("العلوم"), publisherId: getPublisherId("المعاصر"), coverImage: "https://placehold.co/400x550/0ea5e9/ffffff?text=علوم+ابتدائي" },
      { nameAr: "لغة عربية للرابع الابتدائي", slug: "arabic-grade-4", price: "38", stockQuantity: 70, gradeId: getGradeId("الرابع الابتدائي"), stageId: getStageId("ابتدائي"), subjectId: getSubjectId("اللغة العربية"), publisherId: getPublisherId("مكتبة مصر"), coverImage: "https://placehold.co/400x550/d97706/ffffff?text=عربي+ابتدائي" },
      { nameAr: "إنجليزي الثالث الابتدائي", slug: "english-grade-3", price: "42", stockQuantity: 80, isFeatured: true, gradeId: getGradeId("الثالث الابتدائي"), stageId: getStageId("ابتدائي"), subjectId: getSubjectId("اللغة الإنجليزية"), publisherId: getPublisherId("كيان"), coverImage: "https://placehold.co/400x550/7c3aed/ffffff?text=انجليزي+ابتدائي" },
      // Revision books
      { nameAr: "المراجع الذهبي في الرياضيات — الثالث الثانوي", slug: "golden-math-revision-grade-12", price: "130", oldPrice: "160", stockQuantity: 50, isRevision: true, isBestSeller: true, isFeatured: true, gradeId: getGradeId("الثالث الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الرياضيات"), publisherId: getPublisherId("نيوتن"), coverImage: "https://placehold.co/400x550/d97706/ffffff?text=مراجعة+رياضيات" },
      { nameAr: "التفوق في الكيمياء — مراجعة شاملة", slug: "excellence-chemistry-revision", price: "100", stockQuantity: 40, isRevision: true, stageId: getStageId("ثانوي"), subjectId: getSubjectId("الكيمياء"), publisherId: getPublisherId("الإبداع"), coverImage: "https://placehold.co/400x550/16a34a/ffffff?text=مراجعة+كيمياء" },
      { nameAr: "مراجعة نهائية — اللغة العربية الإعدادي", slug: "arabic-revision-preparatory", price: "70", stockQuantity: 65, isRevision: true, stageId: getStageId("إعدادي"), subjectId: getSubjectId("اللغة العربية"), publisherId: getPublisherId("الطالب الناجح"), coverImage: "https://placehold.co/400x550/0ea5e9/ffffff?text=مراجعة+عربي" },
      { nameAr: "ملزمة الفيزياء — الثاني الثانوي", slug: "physics-revision-grade-11", price: "85", oldPrice: "100", stockQuantity: 35, isRevision: true, gradeId: getGradeId("الثاني الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الفيزياء"), publisherId: getPublisherId("كيان"), coverImage: "https://placehold.co/400x550/1e3a5f/ffffff?text=مراجعة+فيزياء" },
      // Bundles
      { nameAr: "مجموعة كتب الثالث الثانوي — علمي", slug: "bundle-grade-12-science", price: "450", oldPrice: "550", stockQuantity: 20, isBundle: true, isFeatured: true, stageId: getStageId("ثانوي"), publisherId: getPublisherId("كيان"), coverImage: "https://placehold.co/400x550/1e3a5f/ffffff?text=مجموعة+ثانوي+علمي" },
      { nameAr: "مجموعة كتب السادس الابتدائي", slug: "bundle-grade-6-primary", price: "250", oldPrice: "320", stockQuantity: 25, isBundle: true, stageId: getStageId("ابتدائي"), gradeId: getGradeId("السادس الابتدائي"), publisherId: getPublisherId("كيان"), coverImage: "https://placehold.co/400x550/0ea5e9/ffffff?text=مجموعة+ابتدائي" },
      // Extra products
      { nameAr: "الدراسات الاجتماعية — الثالث الإعدادي", slug: "social-studies-grade-9", price: "58", stockQuantity: 55, gradeId: getGradeId("الثالث الإعدادي"), stageId: getStageId("إعدادي"), subjectId: getSubjectId("الدراسات"), publisherId: getPublisherId("مكتبة مصر"), coverImage: "https://placehold.co/400x550/7c3aed/ffffff?text=دراسات+إعدادي" },
      { nameAr: "التاريخ — الأول الثانوي", slug: "history-grade-10", price: "72", stockQuantity: 48, gradeId: getGradeId("الأول الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("التاريخ"), publisherId: getPublisherId("دار القلم"), coverImage: "https://placehold.co/400x550/dc2626/ffffff?text=تاريخ+ثانوي" },
      { nameAr: "الجغرافيا — الثاني الثانوي", slug: "geography-grade-11", price: "68", stockQuantity: 42, gradeId: getGradeId("الثاني الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الجغرافيا"), publisherId: getPublisherId("دار القلم"), coverImage: "https://placehold.co/400x550/16a34a/ffffff?text=جغرافيا+ثانوي" },
      { nameAr: "الفرنسية للثاني الثانوي لغات", slug: "french-grade-11-languages", price: "78", stockQuantity: 30, gradeId: getGradeId("الثاني الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الفرنسية"), publisherId: getPublisherId("أكاديمية"), educationType: "لغات", coverImage: "https://placehold.co/400x550/2563eb/ffffff?text=فرنساوي+ثانوي" },
      { nameAr: "رياضيات الأول الثانوي — الطالب الناجح", slug: "math-grade-10-taleb", price: "80", oldPrice: "95", stockQuantity: 67, isNew: true, gradeId: getGradeId("الأول الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الرياضيات"), publisherId: getPublisherId("الطالب الناجح"), coverImage: "https://placehold.co/400x550/d97706/ffffff?text=رياضيات+أول+ثانوي" },
      { nameAr: "منهج العلوم للسادس الابتدائي", slug: "science-grade-6", price: "42", stockQuantity: 88, isNew: true, gradeId: getGradeId("السادس الابتدائي"), stageId: getStageId("ابتدائي"), subjectId: getSubjectId("العلوم"), publisherId: getPublisherId("الإبداع"), coverImage: "https://placehold.co/400x550/0ea5e9/ffffff?text=علوم+سادس" },
      { nameAr: "مراجعة الدراسات — الثانوي العام", slug: "social-revision-secondary", price: "65", stockQuantity: 33, isRevision: true, stageId: getStageId("ثانوي"), subjectId: getSubjectId("الدراسات"), publisherId: getPublisherId("نيوتن"), coverImage: "https://placehold.co/400x550/7c3aed/ffffff?text=دراسات+ثانوي" },
      { nameAr: "كتاب التربية الدينية — الأول الإعدادي", slug: "religion-grade-7", price: "35", stockQuantity: 120, gradeId: getGradeId("الأول الإعدادي"), stageId: getStageId("إعدادي"), subjectId: getSubjectId("التربية الدينية"), publisherId: getPublisherId("مكتبة مصر"), coverImage: "https://placehold.co/400x550/16a34a/ffffff?text=دين+إعدادي" },
      { nameAr: "قواعد اللغة العربية — الثاني الثانوي", slug: "arabic-grammar-grade-11", price: "75", oldPrice: "90", stockQuantity: 55, isBestSeller: true, gradeId: getGradeId("الثاني الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("اللغة العربية"), publisherId: getPublisherId("دار القلم"), coverImage: "https://placehold.co/400x550/1e3a5f/ffffff?text=عربي+ثانوي+قواعد" },
      { nameAr: "الأحياء والجيولوجيا — أول ثانوي", slug: "biology-geology-grade-10", price: "83", stockQuantity: 40, isNew: true, gradeId: getGradeId("الأول الثانوي"), stageId: getStageId("ثانوي"), subjectId: getSubjectId("الأحياء"), publisherId: getPublisherId("كيان"), coverImage: "https://placehold.co/400x550/dc2626/ffffff?text=أحياء+أول+ثانوي" },
      { nameAr: "مجموعة كتب الثالث الإعدادي الكاملة", slug: "bundle-grade-9-complete", price: "299", oldPrice: "380", stockQuantity: 15, isBundle: true, isFeatured: true, stageId: getStageId("إعدادي"), gradeId: getGradeId("الثالث الإعدادي"), publisherId: getPublisherId("كيان"), coverImage: "https://placehold.co/400x550/d97706/ffffff?text=مجموعة+إعدادي" },
    ];

    const inserted = await db.insert(productsTable).values(productsData).onConflictDoNothing().returning();
    console.log(`✅ ${inserted.length} products`);
  } else {
    console.log(`✅ Products already exist (${productsCount.length}), skipping`);
  }

  // Realistic relational fixtures used by the PostgreSQL integration suite.
  await db.transaction(async (tx) => {
    const allProducts = await tx.select().from(productsTable);
    const allGovernorates = await tx.select().from(governoratesTable);
    const allStages = await tx.select().from(stagesTable);
    const allCategories = await tx.select().from(categoriesTable);
    const cairo = allGovernorates.find(g => g.nameEn === "Cairo") ?? allGovernorates[0];
    const giza = allGovernorates.find(g => g.nameEn === "Giza") ?? allGovernorates[1];

    // Make the development storefront exercise every public section while
    // preserving values explicitly maintained by an administrator.
    for (const [index, product] of allProducts.entries()) {
      const stageName = allStages.find(stage => stage.id === product.stageId)?.nameAr || "";
      const category = allCategories.find(item => stageName && item.nameAr.includes(stageName))
        ?? (product.isRevision ? allCategories.find(item => item.slug === "revision") : undefined)
        ?? (product.isBundle ? allCategories.find(item => item.slug === "bundles") : undefined);
      const storefrontDefaults = {
        ...(product.categoryId == null && category ? { categoryId: category.id } : {}),
        ...(product.oldPrice && Number(product.oldPrice) > Number(product.price) ? { isOffer: true } : {}),
        ...(product.schoolYear == null ? { schoolYear: "2026/2027" } : {}),
        ...(index === 0 && !product.freeShipping ? { freeShipping: true, freeShippingBadgeText: "شحن مجاني" } : {}),
      };
      if (Object.keys(storefrontDefaults).length) await tx.update(productsTable).set(storefrontDefaults).where(eq(productsTable.id, product.id));
    }

    if (cairo) {
      const existingCities = await tx.select().from(citiesTable).where(eq(citiesTable.governorateId, cairo.id));
      if (existingCities.length === 0) {
        await tx.insert(citiesTable).values([
          { governorateId: cairo.id, nameAr: "مدينة نصر", nameEn: "Nasr City", surcharge: "0" },
          { governorateId: cairo.id, nameAr: "القاهرة الجديدة", nameEn: "New Cairo", surcharge: "15" },
        ]);
      }
    }
    if (giza) {
      const existingCities = await tx.select().from(citiesTable).where(eq(citiesTable.governorateId, giza.id));
      if (existingCities.length === 0) {
        await tx.insert(citiesTable).values([
          { governorateId: giza.id, nameAr: "الدقي", nameEn: "Dokki", surcharge: "0" },
          { governorateId: giza.id, nameAr: "أكتوبر", nameEn: "6th of October", shippingPriceOverride: "55", surcharge: "10" },
        ]);
      }
    }

    for (const product of allProducts.slice(0, 3)) {
      const existingImages = await tx.select().from(productImagesTable).where(eq(productImagesTable.productId, product.id));
      if (existingImages.length === 0) {
        await tx.insert(productImagesTable).values([
          { productId: product.id, url: product.coverImage ?? `https://placehold.co/400x550?text=${product.id}`, storageKey: `seed/${product.id}/primary.webp`, altText: product.nameAr, sortOrder: 0, isPrimary: true },
          { productId: product.id, url: `https://placehold.co/400x550/f1f5f9/1e293b?text=Back+${product.id}`, storageKey: `seed/${product.id}/back.webp`, altText: `الغلاف الخلفي - ${product.nameAr}`, sortOrder: 1, isPrimary: false },
        ]);
      }
    }

    const employeeFixtures = [
      { name: "مسؤول المبيعات", email: "sales@maktaba.com", role: "sales" as const, permissions: ["dashboard.view", "orders.view", "orders.edit", "customers.view"] },
      { name: "أمين المخزن", email: "warehouse@maktaba.com", role: "warehouse" as const, permissions: ["products.view", "inventory.view", "inventory.adjust"] },
      { name: "مدير المحتوى", email: "content@maktaba.com", role: "content_manager" as const, permissions: ["products.view", "products.create", "products.edit", "products.images.manage", "products.notices.manage", "classifications.view", "classifications.manage", "content.manage"] },
    ];
    const employeePasswordHash = await bcrypt.hash("Employee@2025", 12);
    for (const employee of employeeFixtures) {
      const [found] = await tx.select().from(usersTable).where(eq(usersTable.email, employee.email));
      if (!found) await tx.insert(usersTable).values({ ...employee, passwordHash: employeePasswordHash });
      else await tx.update(usersTable).set({ permissions: employee.permissions }).where(eq(usersTable.id, found.id));
    }

    const optionFixtures = [
      { kind: "teacher" as const, values: ["أحمد السيد", "محمد عبد الجواد"] },
      { kind: "school_year" as const, values: ["2025/2026", "2026/2027"] },
      { kind: "education_type" as const, values: ["عربي", "لغات", "أزهر"] },
    ];
    for (const fixture of optionFixtures) {
      const existingOptions = await tx.select().from(classificationOptionsTable).where(eq(classificationOptionsTable.kind, fixture.kind));
      if (!existingOptions.length) await tx.insert(classificationOptionsTable).values(fixture.values.map((nameAr, index) => ({ kind: fixture.kind, nameAr, sortOrder: index + 1 })));
    }

    let [customer] = await tx.select().from(customersTable).where(eq(customersTable.mobile, "01012345678"));
    if (!customer) {
      [customer] = await tx.insert(customersTable).values({ name: "أحمد محمود", mobile: "01012345678", email: "ahmed@example.com", passwordHash: await bcrypt.hash("Customer@2025", 12) }).returning();
    }
    if (customer && cairo) {
      const [savedAddress] = await tx.select().from(addressesTable).where(eq(addressesTable.customerId, customer.id));
      if (!savedAddress) await tx.insert(addressesTable).values({ customerId: customer.id, governorateId: cairo.id, governorateName: cairo.nameAr, city: "مدينة نصر", detailedAddress: "١٢ شارع المدرسة، الدور الثالث", landmark: "بجوار المكتبة", isDefault: true });
      if (allProducts[0]) await tx.insert(favoritesTable).values({ customerId: customer.id, productId: allProducts[0].id }).onConflictDoNothing();
    }

    const [existingCoupon] = await tx.select().from(couponsTable).where(eq(couponsTable.code, "FREESHIP"));
    if (!existingCoupon) await tx.insert(couponsTable).values({ code: "FREESHIP", type: "free_shipping", value: "0", minOrderAmount: "100", maxUses: 100 });

    const [existingOrder] = await tx.select().from(ordersTable).where(eq(ordersTable.orderNumber, "MK-SEED-0001"));
    const firstProduct = allProducts[0];
    if (!existingOrder && customer && cairo && firstProduct) {
      const subtotal = Number(firstProduct.price) * 2;
      const [order] = await tx.insert(ordersTable).values({
        orderNumber: "MK-SEED-0001", customerId: customer.id, customerName: customer.name,
        mobile: customer.mobile, governorateId: cairo.id, governorateName: cairo.nameAr,
        city: "مدينة نصر", detailedAddress: "١٢ شارع المدرسة، الدور الثالث",
        status: "confirmed", paymentMethod: "cash_on_delivery", paymentStatus: "cash_on_delivery",
        subtotal: String(subtotal), shippingCost: cairo.shippingCost, shippingBaseCost: cairo.shippingCost,
        shippingSurcharge: "0", shippingDiscount: "0", total: String(subtotal + Number(cairo.shippingCost)),
        shippingRuleSnapshot: { governorateId: cairo.id, governorateName: cairo.nameAr, city: "مدينة نصر", baseCost: Number(cairo.shippingCost), surcharge: 0, finalCost: Number(cairo.shippingCost), reason: null },
      }).returning();
      await tx.insert(orderItemsTable).values({ orderId: order.id, productId: firstProduct.id, nameAr: firstProduct.nameAr, coverImage: firstProduct.coverImage, quantity: 2, unitPrice: firstProduct.price, subtotal: String(subtotal) });
      await tx.insert(orderStatusHistoryTable).values({ orderId: order.id, status: "confirmed", notes: "طلب تجريبي مؤكد" });
      await tx.insert(stockMovementsTable).values({ productId: firstProduct.id, movementType: "sale", quantityBefore: firstProduct.stockQuantity, quantityAfter: firstProduct.stockQuantity - 2, quantityChanged: -2, reason: "طلب seed واقعي", orderId: order.id });
    }

    const [owner] = await tx.select().from(usersTable).where(eq(usersTable.email, "admin@maktaba.com"));
    const [existingAudit] = await tx.select().from(auditLogsTable).where(eq(auditLogsTable.action, "seed.completed"));
    if (!existingAudit) await tx.insert(auditLogsTable).values({ employeeId: owner?.id, employeeName: owner?.name, action: "seed.completed", entityType: "system", description: "تهيئة بيانات تطوير واقعية", afterData: { database: "postgresql", fixturesVersion: 1 } });
  });

  console.log("✅ Product images, cities, customers, orders, employees, permissions, inventory and audit fixtures");
  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
