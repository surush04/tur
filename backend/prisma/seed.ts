import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CompanionStatus,
  Difficulty,
  GroupJoinMode,
  GroupMemberRole,
  GroupVisibility,
  ListingStatus,
  PrismaClient,
  Role,
  VideoModeration,
} from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

const credit = 'Wikimedia Commons';
const photo = {
  iskanderkul: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Iskanderkul_and_Fann_Mountains.jpg/1280px-Iskanderkul_and_Fann_Mountains.jpg',
  alaudin: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Alaudin_Lake_in_Fann_Mountains.jpg/1280px-Alaudin_Lake_in_Fann_Mountains.jpg',
  fann: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Fann_Mountains_landscape%2C_Tajikistan.jpg/1280px-Fann_Mountains_landscape%2C_Tajikistan.jpg',
  kulikalon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Kulikalon_Lake%2C_Tajikistan.jpg/1280px-Kulikalon_Lake%2C_Tajikistan.jpg',
  dushanbe: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Palace_of_Nations%2C_Dushanbe%2C_Tajikistan_%281%29.jpg',
  varzob: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Varzob_River.jpg/1280px-Varzob_River.jpg',
  pamir: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Border_Pamir_highway_China.jpg/1280px-Border_Pamir_highway_China.jpg',
  wakhan: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Wakhan%2C_Tajikistan_%2830187116688%29.jpg/1280px-Wakhan%2C_Tajikistan_%2830187116688%29.jpg',
  karakul: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Yak_at_Kara-Kul_Lake.jpg/1280px-Yak_at_Kara-Kul_Lake.jpg',
  hisor: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Tajikistan_-_Hissor_Fortress_%28489352546%29.jpg',
  khorog: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/View_of_Khorog_from_the_Botanical_Gardens.jpg/1280px-View_of_Khorog_from_the_Botanical_Gardens.jpg',
};

function copy(en: string[], ru: string[], tg: string[], title?: string[]) {
  const block = (parts: string[], name?: string) => ({
    title: name,
    summary: parts[0] ?? '',
    description: parts[1] ?? '',
    tips: parts[2],
  });
  return { en: block(en, title?.[0]), ru: block(ru, title?.[1]), tg: block(tg, title?.[2]) };
}

function day(offset: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

async function main() {
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'] ?? 'RohiAdmin!234';
  const demoPassword = process.env['SEED_DEMO_PASSWORD'] ?? 'Traveler!234';
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const adminHash = await bcrypt.hash(adminPassword, 12);

  await prisma.datePollVote.deleteMany();
  await prisma.datePollOption.deleteMany();
  await prisma.datePoll.deleteMany();
  await prisma.tourVote.deleteMany();
  await prisma.tourProposal.deleteMany();
  await prisma.groupMessage.deleteMany();
  await prisma.groupJoinRequest.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.conversationMessage.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.contactRequest.deleteMany();
  await prisma.groupInquiry.deleteMany();
  await prisma.videoLike.deleteMany();
  await prisma.videoComment.deleteMany();
  await prisma.savedVideo.deleteMany();
  await prisma.contentReport.deleteMany();
  await prisma.travelVideo.deleteMany();
  await prisma.travelGroup.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.itineraryActivity.deleteMany();
  await prisma.itineraryDay.deleteMany();
  await prisma.itinerary.deleteMany();
  await prisma.companionJoinRequest.deleteMany();
  await prisma.companionTrip.deleteMany();
  await prisma.bookingTraveler.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.tourImage.deleteMany();
  await prisma.tourDate.deleteMany();
  await prisma.tour.deleteMany();
  await prisma.accommodationImage.deleteMany();
  await prisma.accommodation.deleteMany();
  await prisma.destinationImage.deleteMany();
  await prisma.destination.deleteMany();
  await prisma.guideProfile.deleteMany();
  await prisma.providerListing.deleteMany();
  await prisma.userReport.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@rohi.local',
      passwordHash: adminHash,
      firstName: 'Rohi',
      lastName: 'Admin',
      role: Role.ADMIN,
      language: 'en',
      city: 'Dushanbe',
    },
  });
  const traveler = await prisma.user.create({
    data: {
      email: 'traveler@rohi.local',
      passwordHash,
      firstName: 'Leila',
      lastName: 'Karim',
      role: Role.USER,
      language: 'en',
      city: 'Dushanbe',
      showProfilePublicly: true,
    },
  });
  const guideUser = await prisma.user.create({
    data: {
      email: 'guide@rohi.local',
      passwordHash,
      firstName: 'Farid',
      lastName: 'Saidov',
      role: Role.GUIDE,
      language: 'ru',
      city: 'Dushanbe',
      showProfilePublicly: false,
    },
  });
  const host = await prisma.user.create({
    data: {
      email: 'host@rohi.local',
      passwordHash,
      firstName: 'Amina',
      lastName: 'Nur',
      role: Role.USER,
      language: 'en',
      showProfilePublicly: true,
    },
  });
  const provider = await prisma.user.create({
    data: {
      email: 'provider@rohi.local',
      passwordHash,
      firstName: 'Sadriddin',
      lastName: 'Boboev',
      role: Role.PROVIDER,
      language: 'tg',
    },
  });
  const applicant = await prisma.user.create({
    data: {
      email: 'applicant@rohi.local',
      passwordHash,
      firstName: 'Nodira',
      lastName: 'Rahmon',
      role: Role.USER,
      language: 'tg',
    },
  });

  const guide = await prisma.guideProfile.create({
    data: {
      userId: guideUser.id,
      displayName: 'Farid Saidov',
      region: 'SUGHD',
      languages: ['tg', 'ru', 'en'],
      specialties: ['lakes', 'hiking'],
      bio: 'Demonstration guide profile for the Fann and Iskanderkul catalog. Rohi Travel has not certified this person.',
      yearsExperience: 6,
      priceNote: 'Day rate is not published. Ask for a quote. This profile is a demo record.',
      contactEmail: 'guide@example.com',
      services: ['guiding', 'walking routes'],
      kind: 'GUIDE',
      status: ListingStatus.PUBLISHED,
      verified: false,
      searchText: 'farid saidov sughd lakes hiking guide',
    },
  });
  await prisma.guideProfile.create({
    data: {
      userId: provider.id,
      displayName: 'Pamir Road Desk',
      region: 'GBAO',
      languages: ['ru', 'tg'],
      specialties: ['road'],
      bio: 'Demonstration driver profile. Not a certified transport company. Confirm the vehicle and the road locally.',
      priceNote: 'Shared-car estimates are not live fares.',
      contactEmail: 'driver@example.com',
      services: ['airport pickup', 'shared mountain road'],
      kind: 'DRIVER',
      status: ListingStatus.PUBLISHED,
      verified: false,
      coverImageUrl: photo.pamir,
      searchText: 'pamir driver road gbao',
    },
  });

  const destinations = [
    {
      slug: 'iskanderkul',
      name: 'Iskanderkul Lake',
      region: 'SUGHD',
      category: 'LAKES',
      latitude: '39.075000',
      longitude: '68.368000',
      suggestedDays: 2,
      budgetEstimateMin: '350.00',
      budgetEstimateMax: '900.00',
      activities: ['lakes', 'photography', 'picnic'],
      featured: true,
      trending: true,
      weekend: true,
      budgetFriendly: true,
      cover: photo.iskanderkul,
      alt: 'Iskanderkul and the Fann Mountains',
      images: [photo.iskanderkul, photo.fann],
      copy: copy(
        ['A high lake in the Fann Mountains, often visited from Dushanbe as a short mountain trip.', 'Iskanderkul sits in a mountain bowl above the Iskander Darya. The catalog pin is approximate. Road access changes with weather and maintenance, so confirm the route before you travel.', 'Carry water and a warm layer. Do not treat this page as a road report.'],
        ['Высокогорное озеро в Фанских горах, частая короткая поездка из Душанбе.', 'Искандеркуль лежит в горной чаше. Точка на карте приблизительная. Проезд зависит от погоды и состояния дороги — уточняйте его на месте.', 'Возьмите воду и тёплую одежду. Эта страница не сообщает текущее состояние дороги.'],
        ['Кӯли баландкӯҳ дар кӯҳҳои Фон, сафари кӯтоҳ аз Душанбе.', 'Искандаркӯл дар косаи кӯҳӣ ҷойгир аст. Нуқтаи харита тахминӣ аст. Роҳро пеш аз сафар маҳаллӣ санҷед.', 'Об ва либоси гарм гиред. Ин саҳифа ҳолати ҷории роҳро нишон намедиҳад.'],
      ),
    },
    {
      slug: 'fann-mountains',
      name: 'Fann Mountains',
      region: 'SUGHD',
      category: 'MOUNTAINS',
      latitude: '39.248000',
      longitude: '68.178000',
      suggestedDays: 5,
      budgetEstimateMin: '1800.00',
      budgetEstimateMax: '4200.00',
      activities: ['mountains', 'hiking', 'lakes', 'photography'],
      featured: true,
      trending: true,
      weekend: false,
      budgetFriendly: false,
      cover: photo.alaudin,
      alt: 'Alaudin Lake in the Fann Mountains',
      images: [photo.alaudin, photo.kulikalon, photo.fann],
      copy: copy(
        ['A compact high range west of Dushanbe, known for lakes and footpaths.', 'The Fann Mountains include Alaudin, Kulikalon, and other lakes. This entry is a planning catalog, not a trail guide. Paths and passes are not guaranteed to be open.', 'Hire a local companion for multi-day walking. Maps in the app are not turn-by-turn navigation.'],
        ['Небольшой высокий хребет к западу от Душанбе, известный озёрами и тропами.', 'В Фанах находятся Алаудин, Куликалон и другие озёра. Это каталог для планирования, а не путеводитель по тропам. Проходы не гарантированы.', 'Для многодневного перехода нужен местный сопровождающий. Карта приложения не ведёт по шагам.'],
        ['Қаторкӯҳи баланд дар ғарби Душанбе, бо кӯлҳо ва пайраҳаҳо.', 'Дар Фон кӯлҳои Алаудин, Куликалон ва дигарҳо ҳастанд. Ин феҳрист барои нақша аст, на роҳнамои пайраҳа. Кушода будани ағбаҳо кафолат дода намешавад.', 'Барои роҳравии чандрӯза ҳамроҳи маҳаллӣ гиред. Харита қадам ба қадам нест.'],
      ),
    },
    {
      slug: 'haft-kul',
      name: 'Haft Kul',
      region: 'SUGHD',
      category: 'LAKES',
      latitude: '39.180000',
      longitude: '67.850000',
      suggestedDays: 2,
      budgetEstimateMin: '500.00',
      budgetEstimateMax: '1400.00',
      activities: ['lakes', 'photography', 'hiking'],
      featured: true,
      weekend: true,
      budgetFriendly: true,
      cover: photo.kulikalon,
      alt: 'A highland lake in the Fann area. Not a live photo of every Haft Kul shore.',
      images: [photo.kulikalon],
      copy: copy(
        ['Seven lakes above the Shing valley, near Panjakent. The photograph shows a Fann highland lake, not a verified view of each shore.', 'Haft Kul (the Seven Lakes) is a chain of lakes reached by a mountain road. The coordinate is approximate. Confirm whether the road is open for your vehicle.', 'Allow extra time between lakes. This catalog does not publish driving times.'],
        ['Семь озёр над долиной Шинг, рядом с Пенджикентом. Фотография показывает высокогорное озеро Фан, а не каждый берег.', 'Хафт-Куль — цепочка озёр. Координата приблизительная. Уточните, открыта ли дорога для вашей машины.', 'Между озёрами закладывайте запас времени. Каталог не публикует время в пути.'],
        ['Ҳафт кӯл болотар аз водии Шинг, наздики Панҷакент. Акс кӯли баландкӯҳи Фонро нишон медиҳад.', 'Ҳафткӯл занҷири кӯлҳост. Координата тахминӣ аст. Кушода будани роҳро барои нақлиёти худ санҷед.', 'Байни кӯлҳо вақти иловагӣ гузоред. Феҳрист вақти роҳро нашр намекунад.'],
      ),
    },
    {
      slug: 'pamir-highway',
      name: 'Pamir Highway',
      region: 'GBAO',
      category: 'ROAD',
      latitude: '38.167000',
      longitude: '73.967000',
      suggestedDays: 8,
      budgetEstimateMin: '4500.00',
      budgetEstimateMax: '9000.00',
      activities: ['road', 'mountains', 'photography'],
      featured: true,
      trending: true,
      cover: photo.pamir,
      alt: 'A high section of the Pamir Highway',
      images: [photo.pamir],
      copy: copy(
        ['The M41 high-mountain road across the Pamirs. The pin is a representative point near Murghab, not the whole route.', 'The highway links long distances and high passes. This app does not report which sections are open, and it does not offer offline navigation. Treat every driving time as something to verify.', 'Travel with fuel, water, and a plan agreed with a local driver. The photograph is a highway scene from Wikimedia Commons.'],
        ['Высокогорная трасса М41 через Памир. Метка — условная точка у Мургаба, а не вся дорога.', 'Трасса длинная, с высокими перевалами. Приложение не сообщает, какие участки открыты, и не даёт офлайн-навигации.', 'Берите запас топлива и воды и договаривайтесь с местным водителем. Фотография — сцена трассы с Wikimedia Commons.'],
        ['Роҳи баландкӯҳи М41 аз Помир. Нишона нуқтаи намояндагӣ назди Мурғоб аст, на тамоми роҳ.', 'Роҳ дароз аст. Барнома намегӯяд, ки кадом қитъа кушода аст ва навигатсияи офлайн надорад.', 'Сӯзишворӣ, об ва ронандаи маҳаллиро пешакӣ мувофиқа кунед.'],
      ),
    },
    {
      slug: 'dushanbe',
      name: 'Dushanbe',
      region: 'DUSHANBE',
      category: 'CITIES',
      latitude: '38.573000',
      longitude: '68.786000',
      suggestedDays: 2,
      budgetEstimateMin: '150.00',
      budgetEstimateMax: '700.00',
      activities: ['cities', 'culture'],
      featured: true,
      weekend: true,
      budgetFriendly: true,
      cover: photo.dushanbe,
      alt: 'Palace of Nations in Dushanbe',
      images: [photo.dushanbe],
      copy: copy(
        ['The capital, a practical start for trips into the mountains and a city walk in its own right.', 'Dushanbe has wide avenues, parks, the national museum, and the Palace of Nations area shown in the photograph. Opening hours are not listed because they are not verified here.', 'Use official taxis or a known driver. Museum access should be checked on the day.'],
        ['Столица и удобная точка старта для горных поездок.', 'В Душанбе широкие проспекты, парки, национальный музей и район Дворца нации на фотографии. Часы работы здесь не указаны: они не проверены.', 'Пользуйтесь официальным такси или знакомым водителем.'],
        ['Пойтахт ва нуқтаи оғози сафар ба кӯҳҳо.', 'Душанбе хиёбонҳо, боғҳо, осорхонаи миллӣ ва минтақаи Қасри миллатро дорад. Соати кор ин ҷо навишта нашудааст.', 'Таксии расмӣ ё ронандаи шиносро истифода баред.'],
      ),
    },
    {
      slug: 'varzob',
      name: 'Varzob',
      region: 'DRS',
      category: 'NATURE',
      latitude: '38.773000',
      longitude: '68.817000',
      suggestedDays: 1,
      budgetEstimateMin: '120.00',
      budgetEstimateMax: '400.00',
      activities: ['hiking', 'photography'],
      featured: false,
      weekend: true,
      budgetFriendly: true,
      cover: photo.varzob,
      alt: 'Varzob River',
      images: [photo.varzob],
      copy: copy(
        ['A river valley north of Dushanbe, used as an easy day out from the city.', 'Varzob is close to the capital. The river photograph is from Wikimedia Commons. Trails and swimming spots are not marked as safe or open.', 'Go in daylight and check local advice after rain.'],
        ['Речная долина к северу от Душанбе, удобная для одного дня.', 'Варзоб близко к столице. Фотография реки — с Wikimedia Commons. Тропы и места для купания здесь не отмечены как безопасные.', 'Езжайте засветло и спрашивайте местных после дождя.'],
        ['Водии дарё дар шимоли Душанбе барои як рӯз.', 'Варзоб ба пойтахт наздик аст. Акси дарё аз Wikimedia Commons аст. Пайраҳаҳо бехатар қайд нашудаанд.', 'Рӯзона равед ва пас аз борон маслиҳати маҳаллиро пурсед.'],
      ),
    },
    {
      slug: 'khorog',
      name: 'Khorog',
      region: 'GBAO',
      category: 'CITIES',
      latitude: '37.489000',
      longitude: '71.553000',
      suggestedDays: 2,
      budgetEstimateMin: '1600.00',
      budgetEstimateMax: '3600.00',
      activities: ['cities', 'culture', 'photography'],
      featured: true,
      cover: photo.khorog,
      alt: 'Khorog seen from the botanical garden',
      images: [photo.khorog],
      copy: copy(
        ['The principal town of Gorno-Badakhshan, on the Gunt river below the Pamirs.', 'Khorog is a base for the western Pamirs, with a botanical garden above the town. Travel from Dushanbe is a long mountain journey. This page does not state that the road is open.', 'Permits for GBAO, when required, must be arranged through official channels. This app does not issue permits.'],
        ['Главный город Горно-Бадахшана на реке Гунт.', 'Хорог — база для Западного Памира. Дорога из Душанбе длинная. Страница не утверждает, что она открыта.', 'Разрешения в ГБАО, если они нужны, оформляются официально. Приложение их не выдаёт.'],
        ['Шаҳри асосии ВМКБ дар назди дарёи Ғунд.', 'Хоруғ пойгоҳ барои Помири Ғарбӣ аст. Роҳ аз Душанбе дароз аст. Ин саҳифа кушода будани роҳро тасдиқ намекунад.', 'Иҷозатномаи ВМКБ, агар лозим бошад, танҳо аз роҳи расмӣ гирифта мешавад.'],
      ),
    },
    {
      slug: 'wakhan-valley',
      name: 'Wakhan Valley',
      region: 'GBAO',
      category: 'NATURE',
      latitude: '37.050000',
      longitude: '72.400000',
      suggestedDays: 4,
      budgetEstimateMin: '2800.00',
      budgetEstimateMax: '6200.00',
      activities: ['photography', 'culture', 'road'],
      featured: true,
      trending: true,
      cover: photo.wakhan,
      alt: 'Wakhan in Tajikistan',
      images: [photo.wakhan],
      copy: copy(
        ['A high valley along the Panj, with villages between Ishkashim and the eastern Pamir.', 'The Wakhan is remote. The pin is a representative point in the valley, not a street address. Services are limited and should be arranged before you go.', 'Do not rely on this app for border rules or for a guaranteed drive.'],
        ['Высокая долина вдоль Пянджа, между Ишкашимом и восточным Памиром.', 'Вахан удалён. Метка — условная точка долины, не адрес. Услуги лучше договаривать заранее.', 'Не используйте приложение как источник пограничных правил.'],
        ['Водии баланд дар канори Панҷ, байни Ишкошим ва Помири шарқӣ.', 'Вохон дурдаст аст. Нишона нуқтаи намояндагии водӣ аст, на суроға.', 'Қоидаҳои сарҳадро аз ин барнома нагиред.'],
      ),
    },
    {
      slug: 'karakul',
      name: 'Karakul Lake',
      region: 'GBAO',
      category: 'LAKES',
      latitude: '39.017000',
      longitude: '73.450000',
      suggestedDays: 1,
      budgetEstimateMin: '400.00',
      budgetEstimateMax: '1200.00',
      activities: ['lakes', 'photography', 'road'],
      featured: false,
      trending: true,
      cover: photo.karakul,
      alt: 'Yaks at a Pamir lake known as Kara-Kul',
      images: [photo.karakul],
      copy: copy(
        ['A large high lake in the eastern Pamir, near the M41. The photograph is a Kara-Kul scene from Wikimedia Commons.', 'There is more than one lake with a similar name in the wider Pamir. This catalog entry means the lake in Tajikistan near the highway. The coordinate is approximate.', 'Altitude is high. This page is not medical advice and not a weather forecast.'],
        ['Большое высокогорное озеро в восточном Памире у трассы М41. Фотография — сцена Кара-Куля с Wikimedia Commons.', 'В Памире есть и другие озёра со схожим именем. Здесь имеется в виду озеро в Таджикистане. Координата приблизительная.', 'Высота большая. Страница не является медицинской или погодной справкой.'],
        ['Кӯли калони баландкӯҳ дар Помири шарқӣ назди М41. Акс манзараи Қарокӯл аз Wikimedia Commons аст.', 'Дар Помир кӯлҳои ҳамном ҳастанд. Ин ҷо кӯл дар Тоҷикистон дар назар аст. Координата тахминӣ аст.', 'Баландӣ зиёд аст. Ин саҳифа маслиҳати тиббӣ нест.'],
      ),
    },
    {
      slug: 'hisor-fortress',
      name: 'Hisor Fortress',
      region: 'DRS',
      category: 'CULTURE',
      latitude: '38.473000',
      longitude: '68.555000',
      suggestedDays: 1,
      budgetEstimateMin: '80.00',
      budgetEstimateMax: '250.00',
      activities: ['culture', 'cities'],
      featured: false,
      weekend: true,
      budgetFriendly: true,
      cover: photo.hisor,
      alt: 'Hisor Fortress in Tajikistan',
      images: [photo.hisor],
      copy: copy(
        ['A restored fortress and market town a short drive west of Dushanbe.', 'Hisor (also spelled Hissar) is a cultural stop, not a wilderness trip. The photograph shows the fortress. Entrance rules and hours are not verified in this catalog.', 'Combine it with Dushanbe only if you have confirmed transport for the day.'],
        ['Восстановленная крепость и базарный город недалеко к западу от Душанбе.', 'Гиссар — культурная остановка. На фотографии крепость. Правила входа и часы здесь не проверены.', 'Совмещайте с Душанбе только если транспорт на день уже понятен.'],
        ['Қалъаи барқароршуда ва шаҳраки бозор дар ғарби Душанбе.', 'Ҳисор истгоҳи фарҳангӣ аст. Дар акс қалъа аст. Қоидаи даромад ва соатҳо санҷида нашудаанд.', 'Онро бо Душанбе танҳо вақте якҷо кунед, ки нақлиёт маълум аст.'],
      ),
    },
  ];

  const createdDestinations = new Map<string, { id: string; cover: string }>();
  for (const item of destinations) {
    const searchText = [item.name, item.region, item.category, ...item.activities, JSON.stringify(item.copy)]
      .join(' ')
      .toLowerCase();
    const row = await prisma.destination.create({
      data: {
        slug: item.slug,
        name: item.name,
        region: item.region,
        category: item.category,
        copy: item.copy,
        latitude: item.latitude,
        longitude: item.longitude,
        suggestedDays: item.suggestedDays,
        budgetEstimateMin: item.budgetEstimateMin,
        budgetEstimateMax: item.budgetEstimateMax,
        budgetNote: 'Catalog estimate for planning only. It is not a quote and not a current price.',
        activities: item.activities,
        searchText,
        published: true,
        featured: Boolean(item.featured),
        trending: Boolean(item.trending),
        weekend: Boolean(item.weekend),
        budgetFriendly: Boolean(item.budgetFriendly),
        coverImageUrl: item.cover,
        images: {
          create: item.images.map((url, index) => ({
            url,
            alt: item.alt,
            credit,
            sortOrder: index,
          })),
        },
      },
    });
    createdDestinations.set(item.slug, { id: row.id, cover: item.cover });
  }

  const tours = [
    ['iskanderkul-day', 'iskanderkul', 'Iskanderkul day from Dushanbe', 'LAKES', Difficulty.EASY, 1, '350.00', 'North bus station area, Dushanbe. The exact bay is confirmed after the request is accepted.', ['Shared transport from Dushanbe', 'Guide for the day'], ['Meals', 'Entry fees if any are charged on site'], 'Cancel the request at least 48 hours before the date. Confirmation is manual.'],
    ['fann-lakes-walk', 'fann-mountains', 'Fann lakes walking trip', 'MOUNTAINS', Difficulty.CHALLENGING, 5, '2800.00', 'Dushanbe, hotel pickup only after the request is confirmed.', ['Guide', 'Camp meals on walking days', 'Shared transfer to the trailhead'], ['Personal gear', 'Travel insurance', 'Flights'], 'A request can be cancelled before confirmation without a fee in this demo. After confirmation, ask the operator.'],
    ['haft-kul-weekend', 'haft-kul', 'Haft Kul weekend', 'LAKES', Difficulty.MODERATE, 2, '900.00', 'Dushanbe.', ['Shared transport', 'One night in a simple guesthouse if the property confirms'], ['Meals except breakfast at the stay'], 'The guesthouse night is a request, not a held room.'],
    ['pamir-overview', 'pamir-highway', 'Pamir Highway overview', 'ROAD', Difficulty.CHALLENGING, 8, '6500.00', 'Dushanbe.', ['Driver and vehicle', 'Basic guesthouse nights listed in the itinerary'], ['Permits', 'Meals', 'Flights'], 'This is a request for a long mountain journey. Nothing is reserved until an administrator confirms it.'],
    ['dushanbe-walk', 'dushanbe', 'Dushanbe city walk', 'CULTURE', Difficulty.EASY, 1, '180.00', 'Rudaki Avenue, Dushanbe.', ['Local guide for three hours'], ['Museum tickets', 'Food'], 'Free cancellation of a pending request.'],
    ['varzob-day', 'varzob', 'Varzob valley day', 'NATURE', Difficulty.EASY, 1, '220.00', 'Dushanbe.', ['Shared transport', 'Guide'], ['Meals'], 'Pending requests can be cancelled in the app.'],
    ['wakhan-journey', 'wakhan-valley', 'Wakhan valley journey', 'ROAD', Difficulty.MODERATE, 6, '5200.00', 'Khorog, after you have arrived there.', ['Driver', 'Guide'], ['Permits', 'Meals', 'Flights to or from Dushanbe'], 'Do not treat the catalog price as a paid booking.'],
    ['khorog-town', 'khorog', 'Khorog and the garden', 'CITIES', Difficulty.EASY, 3, '2400.00', 'Khorog center.', ['Guide', 'Two nights in a catalog guesthouse if confirmed'], ['Meals', 'Transport from Dushanbe'], 'Nights stay unconfirmed until an administrator accepts the request.'],
  ] as const;

  const tourIds = new Map<string, string>();
  for (const [slug, dest, title, category, difficulty, daysCount, price, meeting, included, excluded, policy] of tours) {
    const destination = createdDestinations.get(dest);
    if (!destination) continue;
    const titles = [title, title, title];
    const row = await prisma.tour.create({
      data: {
        slug,
        destinationId: destination.id,
        title,
        copy: copy(
          [`Catalog tour: ${title}.`, `${title} uses the destination catalog. The price is a demonstration operator price, not a live fare. Seats are held only when you send a request.`, 'Read the cancellation note before you send a request. No payment is taken in the app.'],
          [`Каталожный тур: ${title}.`, `Цена — демонстрационная цена оператора, не живой тариф. Место удерживается только после заявки.`, 'Оплата в приложении не списывается.'],
          [`Тури феҳрист: ${title}.`, `Нарх нархи намоишии оператор аст, на нархи зинда. Ҷой танҳо пас аз дархост нигоҳ дошта мешавад.`, 'Дар барнома пардохт гирифта намешавад.'],
          titles,
        ),
        category,
        difficulty,
        durationDays: daysCount,
        meetingPoint: meeting,
        included: [...included],
        excluded: [...excluded],
        cancellationPolicy: policy,
        pricePerPerson: price,
        guideId: dest === 'iskanderkul' || dest === 'fann-mountains' ? guide.id : null,
        published: true,
        coverImageUrl: destination.cover,
        searchText: `${title} ${category} ${difficulty}`.toLowerCase(),
        images: { create: [{ url: destination.cover, alt: title, credit, sortOrder: 0 }] },
        dates: {
          create: [14, 28].map((offset) => ({
            startDate: day(offset),
            endDate: day(offset + daysCount - 1),
            capacity: 8,
            bookedSeats: 0,
          })),
        },
      },
    });
    tourIds.set(slug, row.id);
  }

  const lakeTour = tourIds.get('iskanderkul-day');
  const cityTour = tourIds.get('dushanbe-walk');
  if (lakeTour) {
    await prisma.review.create({
      data: {
        userId: traveler.id,
        tourId: lakeTour,
        rating: 5,
        comment: 'Sample review stored for the demo catalog. The lake road should still be checked on the day.',
      },
    });
  }
  if (cityTour) {
    await prisma.review.create({
      data: {
        userId: traveler.id,
        tourId: cityTour,
        rating: 4,
        comment: 'Sample city-walk review. It is a database record, not a scraped testimonial.',
      },
    });
  }

  const dushanbe = createdDestinations.get('dushanbe');
  const isk = createdDestinations.get('iskanderkul');
  const khorogDest = createdDestinations.get('khorog');
  await prisma.accommodation.create({
    data: {
      slug: 'sample-lake-guesthouse',
      name: 'Sample Lake Guesthouse',
      type: 'GUESTHOUSE',
      destinationId: isk?.id,
      region: 'SUGHD',
      copy: copy(
        ['Demonstration guesthouse near Iskanderkul. Not a verified business.', 'This listing exists so the catalog and approval flow can be tried. Mail to example.com is not delivered to a property.', 'Ask for a real property before you travel. Rohi has not inspected this stay.'],
        ['Демонстрационный гостевой дом у Искандеркуля. Это не проверенный объект.', 'Запись нужна, чтобы показать каталог. Письмо на example.com никуда не уходит.', 'Перед поездкой найдите реальное жильё. Rohi его не проверял.'],
        ['Меҳмонхонаи намоишӣ назди Искандаркӯл. Ин корхонаи санҷидашуда нест.', 'Ин сабт барои намоиши феҳрист аст. Почтаи example.com ба ҷойе намеравад.', 'Пеш аз сафар ҷойи воқеиро ёбед.'],
      ),
      priceRangeMin: '180.00',
      priceRangeMax: '320.00',
      priceNote: 'Indicative range for the demo. The property has not confirmed it.',
      contactEmail: 'lake-stay@example.com',
      latitude: '39.080000',
      longitude: '68.370000',
      services: ['breakfast', 'shared bathroom'],
      coverImageUrl: photo.iskanderkul,
      status: ListingStatus.PUBLISHED,
      verified: false,
      searchText: 'sample lake guesthouse sughd iskanderkul',
      images: { create: [{ url: photo.iskanderkul, alt: 'Landscape near the listing region, not a photo of the building', credit, sortOrder: 0 }] },
    },
  });
  await prisma.accommodation.create({
    data: {
      slug: 'sample-dushanbe-hotel',
      name: 'Sample Dushanbe Hotel',
      type: 'HOTEL',
      destinationId: dushanbe?.id,
      region: 'DUSHANBE',
      copy: copy(
        ['Demonstration hotel in the capital. Not a real reservation desk.', 'Use it to browse stay cards. Contact details are example.com and are shown only after sign-in.', 'Rohi Travel does not certify this hotel.'],
        ['Демонстрационный отель в столице. Это не настоящая стойка бронирования.', 'Карточка нужна для просмотра. Контакт — example.com и виден после входа.', 'Rohi Travel не сертифицирует этот отель.'],
        ['Меҳмонхонаи намоишӣ дар пойтахт. Ин мизи бронии воқеӣ нест.', 'Барои дидани кортҳост. Тамос example.com аст ва пас аз воридшавӣ намоён мешавад.', 'Rohi Travel ин меҳмонхонаро тасдиқ намекунад.'],
      ),
      priceRangeMin: '400.00',
      priceRangeMax: '900.00',
      priceNote: 'Indicative demo range per room, not a live rate.',
      contactEmail: 'city-stay@example.com',
      latitude: '38.575000',
      longitude: '68.788000',
      services: ['wifi', 'breakfast'],
      coverImageUrl: photo.dushanbe,
      status: ListingStatus.PUBLISHED,
      verified: false,
      searchText: 'sample dushanbe hotel city',
    },
  });
  await prisma.accommodation.create({
    data: {
      slug: 'sample-khorog-homestay',
      name: 'Sample Khorog Homestay',
      type: 'GUESTHOUSE',
      destinationId: khorogDest?.id,
      region: 'GBAO',
      copy: copy(
        ['Demonstration homestay in Khorog. The family and the house are fictional.', 'The photo is the town from the botanical garden, not the house.', 'Do not send money from this screen.'],
        ['Демонстрационный семейный дом в Хороге. Семья и дом вымышлены.', 'Фотография — вид города, а не дом.', 'Не отправляйте деньги с этого экрана.'],
        ['Хонаи намоишӣ дар Хоруғ. Оила ва хона хаёлӣ ҳастанд.', 'Акс манзараи шаҳр аст, на хона.', 'Аз ин экран пул нафиристед.'],
      ),
      priceRangeMin: '150.00',
      priceRangeMax: '280.00',
      priceNote: 'Demo range. Availability is not tracked.',
      contactEmail: 'khorog-stay@example.com',
      services: ['dinner on request'],
      coverImageUrl: photo.khorog,
      status: ListingStatus.PUBLISHED,
      verified: false,
      searchText: 'sample khorog homestay gbao',
    },
  });

  await prisma.providerListing.create({
    data: {
      ownerId: applicant.id,
      kind: 'ACTIVITY',
      name: 'Sample village walk',
      region: 'DRS',
      description: 'A provider submitted this activity for review. It should stay unpublished until an administrator approves it.',
      contactEmail: 'walk@example.com',
      services: ['walking'],
      priceNote: 'Not priced yet.',
      status: ListingStatus.PENDING_REVIEW,
    },
  });

  await prisma.companionTrip.create({
    data: {
      hostId: host.id,
      title: 'Weekend lakes from Dushanbe',
      destinationName: 'Iskanderkul Lake',
      region: 'SUGHD',
      startDate: day(20),
      endDate: day(21),
      interests: ['lakes', 'photography'],
      budgetEstimate: '800.00',
      companionsWanted: 2,
      description: 'Looking for two people to share a car toward Iskanderkul. Please do not post your phone number in the message.',
      status: CompanionStatus.OPEN,
    },
  });

  const weekendTour = await prisma.tour.findUnique({ where: { slug: 'iskanderkul-day' } });
  const varzobTour = await prisma.tour.findUnique({ where: { slug: 'varzob-day' } });
  const weekend = await prisma.travelGroup.create({
    data: {
      organizerId: traveler.id,
      name: 'Iskanderkul weekend',
      coverImageUrl: photo.iskanderkul,
      destinationName: 'Iskanderkul Lake',
      region: 'SUGHD',
      description: 'A public planning group for a weekend at Iskanderkul. Votes choose a tour and a date. They do not reserve seats.',
      departureDate: day(21),
      flexibleDates: true,
      budgetPerPerson: '900.00',
      desiredSize: 6,
      travelStyle: 'lakes',
      visibility: GroupVisibility.PUBLIC,
      joinMode: GroupJoinMode.REQUEST,
      interests: ['lakes', 'photography'],
      rules: 'Keep phone numbers off the group chat. Agree on a tour before anyone contacts an operator.',
      members: {
        create: [
          { userId: traveler.id, role: GroupMemberRole.ORGANIZER },
          { userId: host.id, role: GroupMemberRole.MEMBER },
        ],
      },
      messages: { create: { body: 'Group created. A vote is not a booking.', system: true } },
    },
  });
  if (weekendTour) {
    await prisma.tourProposal.create({
      data: {
        groupId: weekend.id,
        tourId: weekendTour.id,
        proposerId: host.id,
        operatorName: 'Farid Saidov',
        title: weekendTour.title,
        destinationName: 'Iskanderkul Lake',
        pricePerPerson: weekendTour.pricePerPerson,
        durationDays: weekendTour.durationDays,
        departureDate: day(21),
        included: 'Catalog inclusions for this demonstration tour.',
        excluded: 'Transport to the meeting point unless the tour page lists it.',
        custom: false,
      },
    });
  }
  const poll = await prisma.datePoll.create({
    data: {
      groupId: weekend.id,
      question: 'Which departure date should we ask about?',
      createdById: host.id,
      options: { create: [{ label: day(21).toISOString().slice(0, 10), date: day(21) }, { label: day(28).toISOString().slice(0, 10), date: day(28) }] },
    },
  });
  const firstOption = await prisma.datePollOption.findFirst({ where: { pollId: poll.id }, orderBy: { date: 'asc' } });
  if (firstOption) {
    await prisma.datePollVote.create({ data: { pollId: poll.id, optionId: firstOption.id, userId: host.id } });
  }
  await prisma.travelGroup.create({
    data: {
      organizerId: host.id,
      name: 'Private Pamir notes',
      coverImageUrl: photo.pamir,
      destinationName: 'Pamir Highway',
      region: 'GBAO',
      description: 'Private planning notes. This group must not appear in operator discovery.',
      desiredSize: 4,
      visibility: GroupVisibility.PRIVATE,
      joinMode: GroupJoinMode.REQUEST,
      members: { create: { userId: host.id, role: GroupMemberRole.ORGANIZER } },
    },
  });
  if (varzobTour) {
    await prisma.travelVideo.create({
      data: {
        creatorId: provider.id,
        caption: 'Driving through the Anzob tunnel toward Khujand in July 2024. Wikimedia Commons, Jubaba66.',
        destinationName: 'Anzob Tunnel',
        region: 'DRS',
        posterUrl: photo.varzob,
        videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Tajikistan_Anzob_tunnel_2024.webm',
        tourId: varzobTour.id,
        status: VideoModeration.PUBLISHED,
      },
    });
  }

  await prisma.notification.create({
    data: {
      userId: traveler.id,
      type: 'SYSTEM',
      title: 'Welcome to Rohi Travel',
      body: 'Catalog data is for planning. Booking requests are confirmed by an administrator. No payment is collected in the app.',
    },
  });

  await prisma.auditLog.create({
    data: { actorId: admin.id, action: 'SEED', entity: 'Catalog', metadata: { note: 'Development seed' } },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
