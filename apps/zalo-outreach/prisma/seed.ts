import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create sample templates
  const templates = await Promise.all([
    prisma.template.create({
      data: {
        name: "Chào hỏi cơ bản",
        content:
          "Chào {tên}, mình thấy bạn trong nhóm {nhóm}. Mình đang có sản phẩm/dịch vụ rất phù hợp, bạn có muốn tìm hiểu thêm không?",
        variants: JSON.stringify([
          "Hi {tên}, mình biết bạn qua nhóm {nhóm}. Bạn có quan tâm đến {sản_phẩm} không? Mình chia sẻ thêm nhé!",
          "Xin chào {tên}! Mình thấy bạn cùng nhóm {nhóm}. Bên mình đang có chương trình ưu đãi đặc biệt, bạn muốn xem qua không?",
        ]),
        category: "greeting",
      },
    }),
    prisma.template.create({
      data: {
        name: "Follow up lần 1",
        content:
          "Hi {tên}, hôm trước mình có nhắn tin cho bạn về sản phẩm. Bạn đã có thời gian xem qua chưa?",
        variants: JSON.stringify([
          "{tên} ơi, mình gửi thông tin hôm trước bạn nhận được chưa? Có gì thắc mắc cứ hỏi mình nhé!",
        ]),
        category: "follow_up",
      },
    }),
    prisma.template.create({
      data: {
        name: "Giới thiệu sản phẩm",
        content:
          "Chào {tên}, bên mình đang có {sản_phẩm} với giá ưu đãi. Đặc biệt phù hợp với các bạn trong nhóm {nhóm}. Bạn xem thêm tại đây nhé: [link]",
        variants: JSON.stringify([
          "{tên} ơi, mình chia sẻ với bạn về {sản_phẩm}. Hiện đang có khuyến mãi đặc biệt cho thành viên nhóm {nhóm}. Inbox mình để biết thêm!",
        ]),
        category: "promotion",
      },
    }),
  ]);

  // Create default settings
  const defaultSettings = [
    { key: "default_delay_min", value: "30" },
    { key: "default_delay_max", value: "120" },
    { key: "default_max_per_day", value: "50" },
    { key: "default_active_hours_start", value: "08:00" },
    { key: "default_active_hours_end", value: "21:00" },
    { key: "auto_classify_replies", value: "true" },
    { key: "notification_on_reply", value: "true" },
    { key: "safety_mode", value: "normal" },
    { key: "ai_auto_reply", value: "true" },
    { key: "ai_business_context", value: JSON.stringify({
      business_name: "Tư vấn BĐS Bắc Ninh",
      description: "Tư vấn chung cư, nhà đất tại Bắc Ninh. Hỗ trợ khách hàng tìm hiểu dự án, giá cả, pháp lý.",
      tone: "thân thiện, chuyên nghiệp, như bạn bè"
    }) },
    { key: "ai_reply_style", value: JSON.stringify({
      max_length: "2-3 câu ngắn gọn",
      language: "tiếng Việt tự nhiên, như chat Zalo bình thường",
      forbidden: "không markdown, không bullet points, không dùng từ formal, không xưng em-anh nếu chưa biết giới tính"
    }) },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log(`Seeded ${templates.length} templates`);
  console.log(`Seeded ${defaultSettings.length} settings`);
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
