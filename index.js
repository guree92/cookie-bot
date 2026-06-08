const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const dataPath = path.join(__dirname, 'data.json');
const PARTY_LISTING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const AION2_UPDATES_URL = 'https://aion2.plaync.com/ko-kr/board/update/list';
const AION2_UPDATES_API_URL = 'https://api-community.plaync.com/aion2/board/update_ko/article';

const config = require('./config.json');
const token = process.env.BOT_TOKEN;

if (!token) {
  throw new Error('BOT_TOKEN environment variable is required.');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const jobs = [
  '검성',
  '수호성',
  '살성',
  '궁성',
  '마도성',
  '정령성',
  '치유성',
  '호법성',
];

const partyTemplates = {
  rudra: {
    id: 'rudra',
    title: '루드라 생성',
    icon: '🌀',
    channelBase: '루드라',
    roles: [
      { key: 'main', label: '본캐', limit: 3, style: ButtonStyle.Primary, icon: '⚔️' },
      { key: 'sub', label: '부캐', limit: 3, style: ButtonStyle.Success, icon: '🏹' },
      { key: 'heal', label: '힐러', limit: 2, style: ButtonStyle.Secondary, icon: '💚' },
    ],
  },
  purification: {
    id: 'purification',
    title: '침식의 정화소',
    icon: '🧪',
    channelBase: '침식',
    roles: [
      { key: 'tank', label: '메인탱', limit: 1, style: ButtonStyle.Primary, icon: '🛡️' },
      { key: 'dealer', label: '딜러', limit: 5, style: ButtonStyle.Success, icon: '⚔️' },
      { key: 'heal', label: '힐러', limit: 2, style: ButtonStyle.Secondary, icon: '💚' },
    ],
  },
  muspel: {
    id: 'muspel',
    title: '무스펠의 성배',
    icon: '🏆',
    channelBase: '무스펠',
    roles: [
      { key: 'tank', label: '메인탱', limit: 1, style: ButtonStyle.Primary, icon: '🛡️' },
      { key: 'dealer', label: '딜러', limit: 5, style: ButtonStyle.Success, icon: '⚔️' },
      { key: 'heal', label: '힐러', limit: 2, style: ButtonStyle.Secondary, icon: '💚' },
    ],
  },
};

const defaultData = {
  parties: {},
  updateState: {
    lastAionUpdateUrl: null,
  },
};

const commands = [
  new SlashCommandBuilder()
    .setName('직업선택설치')
    .setDescription('직업 선택 버튼 메시지를 생성합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('메모장설치')
    .setDescription('공개 개인메모장 신청 버튼을 생성합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('메모장신청')
    .setDescription('내 공개 개인메모장을 바로 생성합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('메모장카테고리설정')
    .setDescription('메모장이 생성될 카테고리를 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('카테고리')
        .setDescription('메모장을 생성할 카테고리를 선택하세요.')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('운영진역할설정')
    .setDescription('비공개 문의함을 관리할 운영진 역할을 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((option) =>
      option
        .setName('역할')
        .setDescription('비공개 문의를 볼 운영진 역할을 선택하세요.')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('문의카테고리설정')
    .setDescription('비공개 문의 채널이 생성될 카테고리를 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('카테고리')
        .setDescription('문의 채널을 생성할 카테고리를 선택하세요.')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('해결카테고리설정')
    .setDescription('해결 완료된 문의 채널이 이동할 카테고리를 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('카테고리')
        .setDescription('해결 완료된 문의를 이동할 카테고리를 선택하세요.')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('문의함설치')
    .setDescription('비공개 문의함 버튼 메시지를 생성합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('해결완료')
    .setDescription('현재 문의 채널을 해결완료 카테고리로 이동합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('루드라카테고리설정')
    .setDescription('루드라 파티 채널이 생성될 카테고리를 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('카테고리')
        .setDescription('루드라 파티 채널을 생성할 카테고리를 선택하세요.')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('침식카테고리설정')
    .setDescription('침식의 정화소 파티 채널이 생성될 카테고리를 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('카테고리')
        .setDescription('침식 파티 채널을 생성할 카테고리를 선택하세요.')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('무스펠카테고리설정')
    .setDescription('무스펠의 성배 파티 채널이 생성될 카테고리를 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('카테고리')
        .setDescription('무스펠 파티 채널을 생성할 카테고리를 선택하세요.')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('루드라파티생성')
    .setDescription('루드라 생성 파티 버튼 메시지를 설치합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('침식의정화소파티생성')
    .setDescription('침식의 정화소 파티 버튼 메시지를 설치합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('무스펠의성배파티생성')
    .setDescription('무스펠의 성배 파티 버튼 메시지를 설치합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('파티마감카테고리설정')
    .setDescription('마감된 파티 채널이 이동할 카테고리를 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('카테고리')
        .setDescription('마감된 파티를 이동할 카테고리를 선택하세요.')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('파티마감')
    .setDescription('현재 파티 채널의 모집을 마감합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('업데이트채널설정')
    .setDescription('아이온2 업데이트 노트 자동 공지 채널을 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('채널')
        .setDescription('업데이트 노트를 자동으로 올릴 채널을 선택하세요.')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('업데이트')
    .setDescription('아이온2 최신 업데이트 노트를 확인합니다.'),
];

function loadData() {
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
    return JSON.parse(JSON.stringify(defaultData));
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return {
      parties: parsed.parties || {},
      updateState: parsed.updateState || { lastAionUpdateUrl: null },
    };
  } catch (error) {
    console.error('data.json 로드 중 오류:', error);
    return JSON.parse(JSON.stringify(defaultData));
  }
}

const runtimeData = loadData();

function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify(runtimeData, null, 2));
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(text) {
  return decodeHtmlEntities(text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function buildAionUpdateAnnouncement(update) {
  return [
    '📢 **아이온2 신규 업데이트 노트**',
    `제목: **${update.title}**`,
    update.publishedDate ? `등록일: ${update.publishedDate}` : null,
    update.description ? `요약: ${update.description}` : null,
    `링크: ${update.url}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function fetchLatestAionUpdate() {
  const listResponse = await fetch(AION2_UPDATES_API_URL);
  if (!listResponse.ok) {
    throw new Error(`업데이트 API 요청 실패: ${listResponse.status}`);
  }

  const listJson = await listResponse.json();
  const latestArticle = listJson.contentList?.[0];

  if (!latestArticle?.snow?.contentId) {
    throw new Error('최신 업데이트 데이터를 찾지 못했어요.');
  }

  const articleUrl = `https://aion2.plaync.com/ko-kr/board/update/view?articleId=${latestArticle.snow.contentId}`;
  const publishedDate =
    latestArticle.timestamps?.postDateTime ||
    latestArticle.timestamps?.publishedAt ||
    latestArticle.timestamps?.postedAt ||
    '';

  return {
    url: articleUrl,
    title: stripHtml(latestArticle.title || '아이온2 업데이트 노트'),
    description: stripHtml(latestArticle.summary || ''),
    publishedDate: stripHtml(publishedDate),
  };
}

async function sendLatestAionUpdateToChannel(channel, update) {
  await channel.send(buildAionUpdateAnnouncement(update));
}

async function checkAionUpdatesAndNotify() {
  if (!client.isReady() || !config.aionUpdateChannelId) {
    return;
  }

  try {
    const latestUpdate = await fetchLatestAionUpdate();
    if (!runtimeData.updateState) {
      runtimeData.updateState = { lastAionUpdateUrl: null };
    }

    if (runtimeData.updateState.lastAionUpdateUrl === latestUpdate.url) {
      return;
    }

    const channel = await client.channels.fetch(config.aionUpdateChannelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return;
    }

    if (runtimeData.updateState.lastAionUpdateUrl) {
      await sendLatestAionUpdateToChannel(channel, latestUpdate);
    }

    runtimeData.updateState.lastAionUpdateUrl = latestUpdate.url;
    saveData();
  } catch (error) {
    console.error('아이온2 업데이트 확인 중 오류:', error);
  }
}

async function replyToInteraction(interaction, options) {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(options);
    return;
  }

  await interaction.reply(options);
}

function isMissingPermissionsError(error) {
  return error && (error.code === 50013 || error.status === 403);
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    {
      body: commands.map((command) => command.toJSON()),
    }
  );
}

function createJobRows() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('job_검성')
      .setLabel('검성')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('job_수호성')
      .setLabel('수호성')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('job_살성')
      .setLabel('살성')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('job_궁성')
      .setLabel('궁성')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('job_마도성')
      .setLabel('마도성')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('job_정령성')
      .setLabel('정령성')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('job_치유성')
      .setLabel('치유성')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('job_호법성')
      .setLabel('호법성')
      .setStyle(ButtonStyle.Primary)
  );

  return [row1, row2];
}

function createMemoRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('memo_create')
      .setLabel('메모장 신청')
      .setStyle(ButtonStyle.Primary)
  );
}

function createInquiryRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('inquiry_create')
      .setLabel('비공개 문의')
      .setStyle(ButtonStyle.Primary)
  );
}

function createPartyInstallRows() {
  return [];
}

function createSinglePartyInstallRow(templateId) {
  const template = getTemplateById(templateId);
  if (!template) {
    return [];
  }

  const styleMap = {
    rudra: ButtonStyle.Primary,
    purification: ButtonStyle.Success,
    muspel: ButtonStyle.Danger,
  };

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party_create_${templateId}`)
        .setLabel(template.title)
        .setStyle(styleMap[templateId] || ButtonStyle.Secondary)
    ),
  ];
}

function createPartyScheduleTypeRow(templateId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party_schedule_date_${templateId}`)
        .setLabel('일자')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`party_schedule_range_${templateId}`)
        .setLabel('기간')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createMemoModal() {
  const nicknameInput = new TextInputBuilder()
    .setCustomId('memo_nickname')
    .setLabel('메모장에 사용할 닉네임')
    .setPlaceholder('예: 새유')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(30);

  return new ModalBuilder()
    .setCustomId('memo_modal')
    .setTitle('메모장 신청')
    .addComponents(new ActionRowBuilder().addComponents(nicknameInput));
}

function createInquiryModal() {
  const titleInput = new TextInputBuilder()
    .setCustomId('inquiry_title')
    .setLabel('문의 제목')
    .setPlaceholder('예: 특정 멤버 신고 / 운영 관련 문의')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60);

  const contentInput = new TextInputBuilder()
    .setCustomId('inquiry_content')
    .setLabel('문의 내용')
    .setPlaceholder('운영진에게 전달할 내용을 자세히 적어 주세요.')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  return new ModalBuilder()
    .setCustomId('inquiry_modal')
    .setTitle('비공개 문의')
    .addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(contentInput)
    );
}

function createJobNicknameModal(jobName) {
  const nicknameInput = new TextInputBuilder()
    .setCustomId('job_nickname')
    .setLabel('변경할 닉네임')
    .setPlaceholder('예: 새유')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(24);

  return new ModalBuilder()
    .setCustomId(`job_modal_${jobName}`)
    .setTitle(`${jobName} 닉네임 설정`)
    .addComponents(new ActionRowBuilder().addComponents(nicknameInput));
}

function createPartyDateModal(templateId) {
  const dateInput = new TextInputBuilder()
    .setCustomId('party_date_value')
    .setLabel('일자')
    .setPlaceholder('예: 6/10(수) 또는 2026-06-10')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(40);

  return new ModalBuilder()
    .setCustomId(`party_date_modal_${templateId}`)
    .setTitle('파티 일자 입력')
    .addComponents(new ActionRowBuilder().addComponents(dateInput));
}

function createPartyRangeModal(templateId) {
  const startDateInput = new TextInputBuilder()
    .setCustomId('party_range_start_value')
    .setLabel('기간 시작일')
    .setPlaceholder('예: 2026-06-10 또는 6/10(수)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(40);

  return new ModalBuilder()
    .setCustomId(`party_range_modal_${templateId}`)
    .setTitle('파티 기간 시작일 입력')
    .addComponents(new ActionRowBuilder().addComponents(startDateInput));
}

function formatMemoChannelName(nickname) {
  return `║🔱ㅣ${nickname.replace(/\r?\n/g, ' ').trim()}`.slice(0, 90);
}

function normalizeChannelSegment(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

function formatInquiryChannelName(name) {
  const base = normalizeChannelSegment(name) || '문의';
  const suffix = Date.now().toString().slice(-4);
  return `문의-${base}-${suffix}`.slice(0, 90);
}

function normalizePartyScheduleLabel(value) {
  return value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function parsePartyDateInput(rawValue) {
  const value = rawValue.trim();
  const fullMatch = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const shortMatch = value.match(/^(\d{1,2})[-/.](\d{1,2})/);

  let year;
  let month;
  let day;

  if (fullMatch) {
    year = Number(fullMatch[1]);
    month = Number(fullMatch[2]);
    day = Number(fullMatch[3]);
  } else if (shortMatch) {
    const now = new Date();
    year = now.getFullYear();
    month = Number(shortMatch[1]);
    day = Number(shortMatch[2]);
  } else {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatPartyDateLabel(date) {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]})`;
}

function getPartyRangeEndDate(startDate) {
  const dayOfWeek = startDate.getDay();
  const daysUntilTuesday = (9 - dayOfWeek) % 7;
  return addDays(startDate, daysUntilTuesday);
}

function getPartyWeekRange(baseDate) {
  const startDate = getCurrentWeekWednesday(baseDate);
  const endDate = addDays(startDate, 6);
  return {
    startDate,
    endDate,
    label: `${formatPartyDateLabel(startDate)} ~ ${formatPartyDateLabel(endDate)}`,
  };
}

function getPartyScheduleCloseAt(endDate) {
  return new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1).getTime();
}

function buildPartySchedule(type, rawValue) {
  if (rawValue?.startDate instanceof Date && rawValue?.endDate instanceof Date && rawValue?.label) {
    return {
      type,
      label: rawValue.label,
      startDate: rawValue.startDate,
      endDate: rawValue.endDate,
      closeAt: getPartyScheduleCloseAt(rawValue.endDate),
    };
  }

  if (rawValue instanceof Date) {
    if (type === 'range') {
      const endDate = getPartyRangeEndDate(rawValue);
      return {
        type: 'range',
        label: `${formatPartyDateLabel(rawValue)} ~ ${formatPartyDateLabel(endDate)}`,
        startDate: rawValue,
        endDate,
        closeAt: getPartyScheduleCloseAt(endDate),
      };
    }

    return {
      type: 'date',
      label: formatPartyDateLabel(rawValue),
      startDate: rawValue,
      endDate: rawValue,
      closeAt: getPartyScheduleCloseAt(rawValue),
    };
  }

  const normalizedValue = normalizePartyScheduleLabel(rawValue);
  if (!normalizedValue) {
    return null;
  }

  if (type === 'range') {
    const startDate = parsePartyDateInput(normalizedValue);
    if (!startDate) {
      return null;
    }

    const endDate = getPartyRangeEndDate(startDate);
    return {
      type: 'range',
      label: `${formatPartyDateLabel(startDate)} ~ ${formatPartyDateLabel(endDate)}`,
      startDate,
      endDate,
      closeAt: getPartyScheduleCloseAt(endDate),
    };
  }

  return {
    type: 'date',
    label: normalizedValue,
    closeAt: null,
  };
}

function formatPartyScheduleSegment(scheduleLabel) {
  if (!scheduleLabel) {
    return '';
  }

  return normalizeChannelSegment(scheduleLabel)
    .replace(/-/g, '')
    .slice(0, 16);
}

function formatPartyChannelName(template, sequence, scheduleLabel = '') {
  const scheduleSegment = formatPartyScheduleSegment(scheduleLabel);
  if (!scheduleSegment) {
    return `${template.channelBase}-${sequence}`.slice(0, 90);
  }

  return `${template.channelBase}-${scheduleSegment}-${sequence}`.slice(0, 90);
}

async function getNextPartySequence(guild, template) {
  await guild.channels.fetch();

  const usedNumbers = new Set();

  guild.channels.cache.forEach((channel) => {
    if (channel.type !== ChannelType.GuildText) {
      return;
    }

    if (!channel.name.startsWith(`${template.channelBase}-`)) {
      return;
    }

    const segments = channel.name.split('-');
    const lastSegment = Number(segments[segments.length - 1]);

    if (Number.isInteger(lastSegment) && lastSegment > 0) {
      usedNumbers.add(lastSegment);
    }
  });

  let sequence = 1;
  while (usedNumbers.has(sequence)) {
    sequence += 1;
  }

  return sequence;
}

function isInquiryChannel(channel) {
  return Boolean(channel?.topic && channel.topic.includes('inquiry-owner:'));
}

function getMemoOwnerId(channel) {
  if (!channel.topic) {
    return null;
  }

  const match = channel.topic.match(/memo-owner:(\d+)/);
  return match ? match[1] : null;
}

function getDisplayName(member, user) {
  return member?.nickname || user?.globalName || user?.username || '알 수 없음';
}

function getTemplateById(templateId) {
  return partyTemplates[templateId] || null;
}

function getPartyCategoryId(templateId) {
  const categoryKeyMap = {
    rudra: 'rudraPartyCategoryId',
    purification: 'purificationPartyCategoryId',
    muspel: 'muspelPartyCategoryId',
  };

  const configKey = categoryKeyMap[templateId];
  return configKey ? config[configKey] : null;
}

function isPartyChannel(channel) {
  return Boolean(channel?.topic && channel.topic.includes('party-message:'));
}

function getPartyMessageIdFromChannel(channel) {
  if (!channel?.topic) {
    return null;
  }

  const match = channel.topic.match(/party-message:(\d+)/);
  return match ? match[1] : null;
}

function getPartyByMessageId(messageId) {
  return runtimeData.parties[messageId] || null;
}

function getPartyByChannelId(channelId) {
  return (
    Object.values(runtimeData.parties).find((party) => party.channelId === channelId) || null
  );
}

function getPartyTotalCount(party) {
  return Object.values(party.participants).reduce((total, memberIds) => total + memberIds.length, 0);
}

function getPartyCapacity(party) {
  const template = getTemplateById(party.templateId);
  if (!template) {
    return 0;
  }

  return template.roles.reduce((total, role) => total + role.limit, 0);
}

function formatPartyScheduleLine(party) {
  if (!party.scheduleLabel || !party.scheduleType) {
    return null;
  }

  const scheduleTypeLabel = party.scheduleType === 'range' ? '기간' : '일자';
  return `일정: **${scheduleTypeLabel} | ${party.scheduleLabel}**`;
}

function buildPartyContent(party) {
  const template = getTemplateById(party.templateId);
  if (!template) {
    return '❌ 파티 정보를 불러올 수 없어요.';
  }

  const partyName = formatPartyChannelName(template, party.sequence, party.scheduleLabel);
  const scheduleLine = formatPartyScheduleLine(party);

  const lines = [
    '=============================================',
    `${template.icon} **${template.title} 신청 현황${party.status === 'closed' ? ' (마감)' : ''}**`,
    `전용채널: <#${party.channelId}>`,
    `파티번호: **${partyName}**`,
    `파티장: <@${party.creatorId}>`,
    '',
  ];

  if (scheduleLine) {
    lines.splice(5, 0, scheduleLine);
  }

  for (const role of template.roles) {
    const members = party.participants[role.key] || [];
    lines.push(`${role.icon} ${role.label} ${members.length} / ${role.limit}`);

    if (members.length === 0) {
      lines.push('없음');
    } else {
      members.forEach((userId, index) => {
        lines.push(`${index + 1}. <@${userId}>`);
      });
    }

    lines.push('');
  }

  lines.push(`총 ${getPartyTotalCount(party)} / ${getPartyCapacity(party)}`);

  if (party.status === 'closed') {
    lines.push('모집이 마감되어 더 이상 신청할 수 없어요.');
  } else {
    lines.push('원하는 역할 버튼을 눌러 신청해 주세요.');
  }

  return lines.join('\n');
}

function buildPartySummaryContent(party) {
  const template = getTemplateById(party.templateId);
  if (!template) {
    return '❌ 파티 요약 정보를 불러올 수 없어요.';
  }

  const partyName = formatPartyChannelName(template, party.sequence, party.scheduleLabel);
  const scheduleLine = formatPartyScheduleLine(party);
  const lines = [
    '=============================================',
    `${template.icon} **${template.title} 최종 명단 (마감)**`,
    `전용채널: <#${party.channelId}>`,
    `파티번호: **${partyName}**`,
    `파티장: <@${party.creatorId}>`,
    '',
  ];

  if (scheduleLine) {
    lines.splice(5, 0, scheduleLine);
  }

  for (const role of template.roles) {
    const members = party.participants[role.key] || [];
    lines.push(`${role.icon} ${role.label} ${members.length} / ${role.limit}`);

    if (members.length === 0) {
      lines.push('없음');
    } else {
      members.forEach((userId, index) => {
        lines.push(`${index + 1}. <@${userId}>`);
      });
    }

    lines.push('');
  }

  lines.push(`총 ${getPartyTotalCount(party)} / ${getPartyCapacity(party)}`);
  lines.push('모집이 마감되었어요.');

  return lines.join('\n');
}

function createPartyActionRows(party) {
  const template = getTemplateById(party.templateId);
  if (!template) {
    return [];
  }

  const roleButtons = template.roles.map((role) => {
    const currentCount = party.participants[role.key]?.length || 0;

    return new ButtonBuilder()
      .setCustomId(`party_apply_${role.key}`)
      .setLabel(`${role.label} 신청`)
      .setStyle(role.style)
      .setDisabled(party.status === 'closed' || currentCount >= role.limit);
  });

  const rows = [new ActionRowBuilder().addComponents(...roleButtons)];
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('party_cancel')
        .setLabel('신청 취소')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(party.status === 'closed'),
      new ButtonBuilder()
        .setCustomId('party_close')
        .setLabel('신청 마감')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(party.status === 'closed')
    )
  );

  return rows;
}

async function updatePartyMessage(guild, party) {
  const channel = await guild.channels.fetch(party.messageChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return;
  }

  const message = await channel.messages.fetch(party.messageId).catch(() => null);
  if (!message) {
    return;
  }

  await message.edit({
    content: buildPartyContent(party),
    components: createPartyActionRows(party),
  });
}

async function deletePartyListingMessage(guild, party) {
  const channel = await guild.channels.fetch(party.messageChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return false;
  }

  const message = await channel.messages.fetch(party.messageId).catch(() => null);
  if (!message) {
    return false;
  }

  await message.delete().catch(() => null);
  party.listingDeletedAt = Date.now();
  saveData();
  return true;
}

async function sendPartySummaryMessage(guild, party) {
  const channel = await guild.channels.fetch(party.messageChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return null;
  }

  const summaryMessage = await channel.send(buildPartySummaryContent(party));
  party.summaryMessageId = summaryMessage.id;
  party.summarySentAt = Date.now();
  saveData();
  return summaryMessage;
}

async function setChannelAccess(channel, userId, enabled) {
  if (enabled) {
    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
    return;
  }

  await channel.permissionOverwrites.delete(userId).catch(() => null);
}

async function syncPartyChannelPermissions(guild, party) {
  const channel = await guild.channels.fetch(party.channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return;
  }

  const activeUserIds = new Set([party.creatorId]);
  for (const roleUsers of Object.values(party.participants)) {
    roleUsers.forEach((userId) => activeUserIds.add(userId));
  }

  if (config.managerRoleId) {
    await channel.permissionOverwrites.edit(config.managerRoleId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ManageMessages: true,
    });
  }

  for (const userId of activeUserIds) {
    await setChannelAccess(channel, userId, true);
  }

  for (const userId of party.knownUserIds || []) {
    if (!activeUserIds.has(userId)) {
      await setChannelAccess(channel, userId, false);
    }
  }

  party.knownUserIds = Array.from(activeUserIds);
  saveData();
}

async function createParty(interaction, templateId, scheduleInput = null) {
  const guild = interaction.guild;
  const member = interaction.member;
  const template = getTemplateById(templateId);

  if (!guild || !member || !template) {
    await replyToInteraction(interaction, {
      content: '❌ 파티를 생성할 수 없어요.',
      ephemeral: true,
    });
    return;
  }

  const partyCategoryId = getPartyCategoryId(template.id);

  if (!partyCategoryId) {
    await replyToInteraction(interaction, {
      content: '❌ 먼저 관리자가 이 던전 전용 파티 카테고리를 설정해야 해요.',
      ephemeral: true,
    });
    return;
  }

  const schedule = buildPartySchedule(scheduleInput?.type || 'date', scheduleInput?.value || '');
  if (!schedule) {
    await replyToInteraction(interaction, {
      content:
        scheduleInput?.type === 'range'
          ? '기간 시작일은 `2026-06-10` 또는 `6/10` 형식으로 입력해 주세요.'
          : '일자를 입력해 주세요.',
      ephemeral: true,
    });
    return;
  }

  const sequence = await getNextPartySequence(guild, template);
  const channelName = formatPartyChannelName(template, sequence, schedule.label);

  try {
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ];

    if (client.user) {
      permissionOverwrites.push({
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }

    if (config.managerRoleId) {
      permissionOverwrites.push({
        id: config.managerRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: partyCategoryId,
      topic: `party-template:${template.id}|party-message:pending`,
      permissionOverwrites,
    });

    const party = {
      templateId: template.id,
      creatorId: interaction.user.id,
      channelId: channel.id,
      messageChannelId: interaction.channelId,
      messageId: '',
      sequence,
      scheduleType: schedule.type,
      scheduleLabel: schedule.label,
      scheduleStartAt: schedule.startDate?.getTime() || null,
      scheduleEndAt: schedule.endDate?.getTime() || null,
      autoCloseAt: schedule.closeAt || null,
      status: 'open',
      createdAt: Date.now(),
      participants: Object.fromEntries(template.roles.map((role) => [role.key, []])),
      knownUserIds: [interaction.user.id],
    };

    const message = await interaction.channel.send({
      content: buildPartyContent({ ...party, messageId: 'pending' }),
      components: createPartyActionRows(party),
    });

    party.messageId = message.id;
    runtimeData.parties[message.id] = party;
    saveData();

    await channel.setTopic(`party-template:${template.id}|party-message:${message.id}`);
    await channel.send(
      [
        `${template.icon} **${template.title} 전용 채널이 생성됐어요.**`,
        '이 채널은 신청자만 볼 수 있어요.',
        '파티장과 참가자끼리 자유롭게 소통해 주세요.',
      ].join('\n')
    );

    await message.edit({
      content: buildPartyContent(party),
      components: createPartyActionRows(party),
    });

    await replyToInteraction(interaction, {
      content: `✅ ${template.title} 파티가 생성됐어요. 전용 채널: <#${channel.id}>`,
      ephemeral: true,
    });
  } catch (error) {
    saveData();

    console.error('파티 생성 중 오류:', error);
    const content = isMissingPermissionsError(error)
      ? '❌ 파티 채널을 만들 권한이 부족해요. 봇 역할에 `채널 관리`와 파티 카테고리 접근 권한이 있는지 확인해 주세요.'
      : '❌ 파티 생성 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';

    await replyToInteraction(interaction, {
      content,
      ephemeral: true,
    });
  }
}

async function applyToParty(interaction, roleKey) {
  const guild = interaction.guild;
  const party = getPartyByMessageId(interaction.message.id);

  if (!guild || !party) {
    await replyToInteraction(interaction, {
      content: '❌ 파티 정보를 찾을 수 없어요.',
      ephemeral: true,
    });
    return;
  }

  if (party.status === 'closed') {
    await replyToInteraction(interaction, {
      content: '❌ 이미 마감된 파티예요.',
      ephemeral: true,
    });
    return;
  }

  const template = getTemplateById(party.templateId);
  const targetRole = template?.roles.find((role) => role.key === roleKey);

  if (!template || !targetRole) {
    await replyToInteraction(interaction, {
      content: '❌ 신청 역할을 찾을 수 없어요.',
      ephemeral: true,
    });
    return;
  }

  let currentRoleKey = null;
  for (const role of template.roles) {
    if (party.participants[role.key]?.includes(interaction.user.id)) {
      currentRoleKey = role.key;
      break;
    }
  }

  if (currentRoleKey === roleKey) {
    await replyToInteraction(interaction, {
      content: `❌ 이미 ${targetRole.label}로 신청되어 있어요.`,
      ephemeral: true,
    });
    return;
  }

  const currentCount = party.participants[roleKey].length;
  if (currentCount >= targetRole.limit) {
    await replyToInteraction(interaction, {
      content: `❌ ${targetRole.label} 정원이 가득 찼어요.`,
      ephemeral: true,
    });
    return;
  }

  if (currentRoleKey) {
    party.participants[currentRoleKey] = party.participants[currentRoleKey].filter(
      (userId) => userId !== interaction.user.id
    );
  }

  party.participants[roleKey].push(interaction.user.id);
  if (!party.knownUserIds.includes(interaction.user.id)) {
    party.knownUserIds.push(interaction.user.id);
  }

  saveData();

  try {
    await syncPartyChannelPermissions(guild, party);
    await updatePartyMessage(guild, party);

    const channel = await guild.channels.fetch(party.channelId);
    await channel?.send(`✅ ${interaction.user}님이 ${targetRole.label}로 신청했어요.`);

    await replyToInteraction(interaction, {
      content: `✅ ${targetRole.label}로 신청됐어요. 이제 <#${party.channelId}> 채널을 볼 수 있어요.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('파티 신청 처리 중 오류:', error);
    await replyToInteraction(interaction, {
      content: '❌ 파티 신청 처리 중 오류가 발생했어요.',
      ephemeral: true,
    });
  }
}

async function cancelPartyApplication(interaction) {
  const guild = interaction.guild;
  const party = getPartyByMessageId(interaction.message.id);

  if (!guild || !party) {
    await replyToInteraction(interaction, {
      content: '❌ 파티 정보를 찾을 수 없어요.',
      ephemeral: true,
    });
    return;
  }

  if (party.status === 'closed') {
    await replyToInteraction(interaction, {
      content: '❌ 이미 마감된 파티예요.',
      ephemeral: true,
    });
    return;
  }

  let removed = false;
  for (const [roleKey, members] of Object.entries(party.participants)) {
    if (members.includes(interaction.user.id)) {
      party.participants[roleKey] = members.filter((userId) => userId !== interaction.user.id);
      removed = true;
    }
  }

  if (!removed) {
    await replyToInteraction(interaction, {
      content: '❌ 현재 신청한 역할이 없어요.',
      ephemeral: true,
    });
    return;
  }

  saveData();

  try {
    await syncPartyChannelPermissions(guild, party);
    await updatePartyMessage(guild, party);

    const channel = await guild.channels.fetch(party.channelId);
    await channel?.send(`❌ ${interaction.user}님이 파티 신청을 취소했어요.`);

    await replyToInteraction(interaction, {
      content: `✅ 신청이 취소됐어요. 이제 <#${party.channelId}> 채널 접근 권한이 제거됐어요.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('파티 취소 처리 중 오류:', error);
    await replyToInteraction(interaction, {
      content: '❌ 파티 신청 취소 중 오류가 발생했어요.',
      ephemeral: true,
    });
  }
}

async function closeParty(interaction) {
  const guild = interaction.guild;
  const channel = interaction.channel;

  if (!guild || !channel || channel.type !== ChannelType.GuildText) {
    await replyToInteraction(interaction, {
      content: '❌ 서버의 텍스트 채널에서만 사용할 수 있어요.',
      ephemeral: true,
    });
    return;
  }

  const party = getPartyByChannelId(channel.id);
  if (!party) {
    await replyToInteraction(interaction, {
      content: '❌ 현재 채널은 파티 전용 채널이 아니에요.',
      ephemeral: true,
    });
    return;
  }

  const isManager = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (!isManager && interaction.user.id !== party.creatorId) {
    await replyToInteraction(interaction, {
      content: '❌ 파티장 또는 관리자만 마감할 수 있어요.',
      ephemeral: true,
    });
    return;
  }

  if (party.status === 'closed') {
    await replyToInteraction(interaction, {
      content: '❌ 이미 마감된 파티예요.',
      ephemeral: true,
    });
    return;
  }

  party.status = 'closed';
  saveData();

  try {
    await sendPartySummaryMessage(guild, party);
    await deletePartyListingMessage(guild, party);
    if (config.closedPartyCategoryId) {
      await channel.setParent(config.closedPartyCategoryId, { lockPermissions: false });
    }
    await channel.send('✅ 이 파티는 마감 완료되었어요. 이제 더 이상 신청할 수 없어요.');

    await replyToInteraction(interaction, {
      content: '✅ 현재 파티 모집을 마감했어요.',
      ephemeral: true,
    });
  } catch (error) {
    console.error('파티 마감 중 오류:', error);
    await replyToInteraction(interaction, {
      content: '❌ 파티 마감 중 오류가 발생했어요.',
      ephemeral: true,
    });
  }
}

async function closePartyFromButton(interaction, guild, party) {
  party.status = 'closed';
  saveData();

  try {
    await sendPartySummaryMessage(guild, party);
    await deletePartyListingMessage(guild, party);
    const partyChannel = await guild.channels.fetch(party.channelId).catch(() => null);
    if (partyChannel && config.closedPartyCategoryId) {
      await partyChannel.setParent(config.closedPartyCategoryId, {
        lockPermissions: false,
      });
    }
    await partyChannel?.send('✅ 파티장이 신청 마감을 눌러 모집이 종료됐어요.');

    await replyToInteraction(interaction, {
      content: '✅ 신청 마감 처리됐어요. 최종 명단을 보냈고 기존 신청 현황은 삭제했어요.',
      ephemeral: true,
    });
  } catch (error) {
    console.error('파티 버튼 마감 중 오류:', error);
    await replyToInteraction(interaction, {
      content: '❌ 신청 마감 처리 중 오류가 발생했어요.',
      ephemeral: true,
    });
  }
}

async function closePartyAutomatically(guild, party) {
  party.status = 'closed';
  party.closedAt = Date.now();
  party.closedReason = 'auto_schedule_end';
  saveData();

  try {
    await sendPartySummaryMessage(guild, party);
    await deletePartyListingMessage(guild, party);

    const partyChannel = await guild.channels.fetch(party.channelId).catch(() => null);
    if (partyChannel && config.closedPartyCategoryId) {
      await partyChannel.setParent(config.closedPartyCategoryId, {
        lockPermissions: false,
      });
    }

    await partyChannel?.send('선택한 파티 일정이 종료되어 모집이 자동 마감되었어요.');
  } catch (error) {
    console.error('파티 자동 마감 중 오류:', error);
  }
}

async function cleanupExpiredPartyListings() {
  if (!client.isReady()) {
    return;
  }

  const now = Date.now();
  const guildCache = new Map();

  for (const party of Object.values(runtimeData.parties)) {
    if (party.status !== 'open') {
      continue;
    }

    let guild = guildCache.get(config.guildId);
    if (!guild) {
      guild = await client.guilds.fetch(config.guildId).catch(() => null);
      if (!guild) {
        return;
      }
      guildCache.set(config.guildId, guild);
    }

    if (party.autoCloseAt && now >= party.autoCloseAt) {
      await closePartyAutomatically(guild, party);
      continue;
    }

    if (party.listingDeletedAt || !party.createdAt) {
      continue;
    }

    if (now - party.createdAt < PARTY_LISTING_TTL_MS) {
      continue;
    }

    await deletePartyListingMessage(guild, party);
  }
}

async function findExistingMemoChannel(guild, userId) {
  await guild.channels.fetch();

  return guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText && getMemoOwnerId(channel) === userId
  );
}

async function createMemoChannel(interaction, nickname) {
  const guild = interaction.guild;
  const member = interaction.member;

  if (!guild || !member) {
    await interaction.reply({
      content: '❌ 서버 안에서만 사용할 수 있어요.',
      ephemeral: true,
    });
    return;
  }

  if (!config.memoCategoryId) {
    await interaction.reply({
      content: '❌ 먼저 관리자가 `/메모장카테고리설정`으로 메모장 카테고리를 설정해야 해요.',
      ephemeral: true,
    });
    return;
  }

  const existingChannel = await findExistingMemoChannel(guild, interaction.user.id);

  if (existingChannel) {
    await interaction.reply({
      content: `❌ 이미 메모장이 있어요: <#${existingChannel.id}>`,
      ephemeral: true,
    });
    return;
  }

  const displayName =
    nickname ||
    interaction.member.nickname ||
    interaction.user.globalName ||
    interaction.user.username;
  const channelName = formatMemoChannelName(displayName);
  const categoryId = config.memoCategoryId || null;

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: `memo-owner:${interaction.user.id}`,
    });

    await channel.lockPermissions().catch(() => null);
    await channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ManageMessages: true,
    });

    await channel.send(
      [
        `📝 ${interaction.user}님의 공개 메모장이 생성됐어요.`,
        '이 채널은 모두가 볼 수 있고, 모두가 메세지를 작성할 수 있어요.',
        '메모장 주인은 이 채널에서 다른 사람 메세지를 삭제할 수 있어요.',
      ].join('\n')
    );

    await replyToInteraction(interaction, {
      content: `✅ 메모장이 생성됐어요: <#${channel.id}>`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('메모장 생성 중 오류:', error);

    const content = isMissingPermissionsError(error)
      ? '❌ 메모장 채널을 만들 권한이 부족해요. 봇 역할에 `채널 관리`, 해당 카테고리 접근 권한이 있는지 확인해 주세요.'
      : '❌ 메모장 생성 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';

    await replyToInteraction(interaction, {
      content,
      ephemeral: true,
    });
  }
}

async function createInquiryChannel(interaction, title, content) {
  const guild = interaction.guild;
  const member = interaction.member;

  if (!guild || !member) {
    await interaction.reply({
      content: '❌ 서버 안에서만 사용할 수 있어요.',
      ephemeral: true,
    });
    return;
  }

  if (!config.inquiryCategoryId) {
    await interaction.reply({
      content: '❌ 먼저 관리자가 `/문의카테고리설정`으로 문의 카테고리를 설정해야 해요.',
      ephemeral: true,
    });
    return;
  }

  if (!config.managerRoleId) {
    await interaction.reply({
      content: '❌ 먼저 관리자가 `/운영진역할설정`으로 운영진 역할을 설정해야 해요.',
      ephemeral: true,
    });
    return;
  }

  const displayName =
    interaction.member.nickname ||
    interaction.user.globalName ||
    interaction.user.username;
  try {
    const channel = await guild.channels.create({
      name: formatInquiryChannelName(displayName),
      type: ChannelType.GuildText,
      parent: config.inquiryCategoryId,
      topic: `inquiry-owner:${interaction.user.id}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: config.managerRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ],
    });

    await channel.send(
      [
        `🔒 ${interaction.user}님의 비공개 문의가 접수됐어요.`,
        `**제목:** ${title}`,
        '',
        content,
      ].join('\n')
    );

    await replyToInteraction(interaction, {
      content: `✅ 비공개 문의 채널이 생성됐어요: <#${channel.id}>`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('비공개 문의 채널 생성 중 오류:', error);

    const content = isMissingPermissionsError(error)
      ? '❌ 비공개 문의 채널을 만들 권한이 부족해요. 봇 역할에 `채널 관리`, 문의 카테고리 접근 권한, 운영진 역할 보기 권한이 있는지 확인해 주세요.'
      : '❌ 비공개 문의 생성 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';

    await replyToInteraction(interaction, {
      content,
      ephemeral: true,
    });
  }
}

async function moveInquiryToResolved(interaction) {
  const guild = interaction.guild;
  const channel = interaction.channel;

  if (!guild || !channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: '❌ 서버의 텍스트 채널에서만 사용할 수 있어요.',
      ephemeral: true,
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
      ephemeral: true,
    });
    return;
  }

  if (!config.resolvedInquiryCategoryId) {
    await interaction.reply({
      content: '❌ 먼저 관리자가 `/해결카테고리설정`으로 해결완료 카테고리를 설정해야 해요.',
      ephemeral: true,
    });
    return;
  }

  if (!isInquiryChannel(channel)) {
    await interaction.reply({
      content: '❌ 이 채널은 비공개 문의 채널이 아니에요.',
      ephemeral: true,
    });
    return;
  }

  try {
    await channel.setParent(config.resolvedInquiryCategoryId, { lockPermissions: false });
    await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
      SendMessages: false,
    });

    const ownerMatch = channel.topic?.match(/inquiry-owner:(\d+)/);
    if (ownerMatch) {
      await channel.permissionOverwrites.edit(ownerMatch[1], {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false,
      });
    }

    if (config.managerRoleId) {
      await channel.permissionOverwrites.edit(config.managerRoleId, {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false,
        ManageMessages: true,
      });
    }

    await channel.send('✅ 이 문의는 해결 완료되어 해결완료 카테고리로 이동됐어요.');

    await interaction.reply({
      content: '✅ 현재 문의 채널을 해결완료 카테고리로 이동했어요.',
      ephemeral: true,
    });
  } catch (error) {
    console.error('문의 채널 이동 중 오류:', error);

    const content = isMissingPermissionsError(error)
      ? '❌ 문의 채널을 이동할 권한이 부족해요. 봇 역할에 `채널 관리`와 해결완료 카테고리 접근 권한이 있는지 확인해 주세요.'
      : '❌ 문의 채널 이동 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';

    await replyToInteraction(interaction, {
      content,
      ephemeral: true,
    });
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`${client.user.tag} 로그인 성공!`);
  setInterval(() => {
    cleanupExpiredPartyListings().catch((error) => {
      console.error('파티 신청 현황 자동 삭제 중 오류:', error);
    });
  }, 60 * 1000);
  setInterval(() => {
    checkAionUpdatesAndNotify().catch((error) => {
      console.error('아이온2 업데이트 자동 공지 중 오류:', error);
    });
  }, UPDATE_CHECK_INTERVAL_MS);
  await checkAionUpdatesAndNotify();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (
      interaction.commandName !== '업데이트' &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.reply({
        content: '❌ `/업데이트`를 제외한 슬래시 명령어는 관리자만 사용할 수 있어요.',
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '직업선택설치') {
      await interaction.reply({
        content:
          '🎭 **직업을 선택해 주세요!**\n\n한 사람당 직업은 1개만 선택할 수 있어요.\n새 직업을 선택하면 기존 직업은 자동으로 제거돼요.',
        components: createJobRows(),
      });
      return;
    }

    if (interaction.commandName === '메모장설치') {
      await interaction.reply({
        content:
          '📝 **공개 개인메모장 신청**\n\n버튼을 누르면 운영진 승인 없이 바로 개인 메모장이 생성돼요.\n한 사람당 메모장은 1개만 만들 수 있고, 채널은 전체 공개예요.',
        components: [createMemoRow()],
      });
      return;
    }

    if (interaction.commandName === '메모장신청') {
      await interaction.showModal(createMemoModal());
      return;
    }

    if (interaction.commandName === '메모장카테고리설정') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const category = interaction.options.getChannel('카테고리', true);
      config.memoCategoryId = category.id;
      saveConfig();

      await interaction.reply({
        content: `✅ 메모장 생성 카테고리를 **${category.name}**로 설정했어요.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '운영진역할설정') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const role = interaction.options.getRole('역할', true);
      config.managerRoleId = role.id;
      saveConfig();

      await interaction.reply({
        content: `✅ 운영진 역할을 **${role.name}**로 설정했어요.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '문의카테고리설정') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const category = interaction.options.getChannel('카테고리', true);
      config.inquiryCategoryId = category.id;
      saveConfig();

      await interaction.reply({
        content: `✅ 비공개 문의 카테고리를 **${category.name}**로 설정했어요.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '해결카테고리설정') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const category = interaction.options.getChannel('카테고리', true);
      config.resolvedInquiryCategoryId = category.id;
      saveConfig();

      await interaction.reply({
        content: `✅ 해결완료 카테고리를 **${category.name}**로 설정했어요.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '문의함설치') {
      await interaction.reply({
        content:
          '🔒 **비공개 문의함**\n\n버튼을 누르면 운영진만 볼 수 있는 개인 문의 채널이 생성돼요.',
        components: [createInquiryRow()],
      });
      return;
    }

    if (interaction.commandName === '해결완료') {
      await moveInquiryToResolved(interaction);
      return;
    }

    if (interaction.commandName === '루드라카테고리설정') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const category = interaction.options.getChannel('카테고리', true);
      config.rudraPartyCategoryId = category.id;
      saveConfig();

      await interaction.reply({
        content: `✅ 루드라 파티 카테고리를 **${category.name}**로 설정했어요.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '침식카테고리설정') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const category = interaction.options.getChannel('카테고리', true);
      config.purificationPartyCategoryId = category.id;
      saveConfig();

      await interaction.reply({
        content: `✅ 침식 파티 카테고리를 **${category.name}**로 설정했어요.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '무스펠카테고리설정') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const category = interaction.options.getChannel('카테고리', true);
      config.muspelPartyCategoryId = category.id;
      saveConfig();

      await interaction.reply({
        content: `✅ 무스펠 파티 카테고리를 **${category.name}**로 설정했어요.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '루드라파티생성') {
      await interaction.reply({
        content: '🎫 **루드라 생성 파티**\n\n버튼을 누르면 신청 현황 메시지와 전용 채널이 자동 생성돼요.',
        components: createSinglePartyInstallRow('rudra'),
      });
      return;
    }

    if (interaction.commandName === '침식의정화소파티생성') {
      await interaction.reply({
        content: '🎫 **침식의 정화소 파티**\n\n버튼을 누르면 신청 현황 메시지와 전용 채널이 자동 생성돼요.',
        components: createSinglePartyInstallRow('purification'),
      });
      return;
    }

    if (interaction.commandName === '무스펠의성배파티생성') {
      await interaction.reply({
        content: '🎫 **무스펠의 성배 파티**\n\n버튼을 누르면 신청 현황 메시지와 전용 채널이 자동 생성돼요.',
        components: createSinglePartyInstallRow('muspel'),
      });
      return;
    }

    if (interaction.commandName === '파티생성설치') {
      await interaction.reply({
        content: '❌ 이 명령어는 더 이상 사용하지 않아요. `/루드라파티생성`, `/침식의정화소파티생성`, `/무스펠의성배파티생성`을 사용해 주세요.',
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '파티마감카테고리설정') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const category = interaction.options.getChannel('카테고리', true);
      config.closedPartyCategoryId = category.id;
      saveConfig();

      await interaction.reply({
        content: `✅ 마감된 파티 카테고리를 **${category.name}**로 설정했어요.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '파티마감') {
      await closeParty(interaction);
      return;
    }

    if (interaction.commandName === '업데이트채널설정') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ 이 명령어는 관리자만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const channel = interaction.options.getChannel('채널', true);
      config.aionUpdateChannelId = channel.id;
      saveConfig();

      await interaction.reply({
        content: `✅ 아이온2 업데이트 자동 공지 채널을 <#${channel.id}>로 설정했어요.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === '업데이트') {
      try {
        const latestUpdate = await fetchLatestAionUpdate();
        await interaction.reply({
          content: buildAionUpdateAnnouncement(latestUpdate),
          ephemeral: true,
        });
      } catch (error) {
        console.error('수동 업데이트 조회 중 오류:', error);
        await interaction.reply({
          content: '❌ 최신 업데이트 노트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
          ephemeral: true,
        });
      }
      return;
    }

    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'memo_modal') {
      const nickname = interaction.fields.getTextInputValue('memo_nickname');
      await createMemoChannel(interaction, nickname);
      return;
    }

    if (interaction.customId === 'inquiry_modal') {
      const title = interaction.fields.getTextInputValue('inquiry_title');
      const content = interaction.fields.getTextInputValue('inquiry_content');
      await createInquiryChannel(interaction, title, content);
      return;
    }

    if (interaction.customId.startsWith('party_date_modal_')) {
      const templateId = interaction.customId.replace('party_date_modal_', '');
      const dateValue = interaction.fields.getTextInputValue('party_date_value');
      await createParty(interaction, templateId, { type: 'date', value: dateValue });
      return;
    }

    if (interaction.customId.startsWith('party_range_modal_')) {
      const templateId = interaction.customId.replace('party_range_modal_', '');
      const startDateValue = interaction.fields.getTextInputValue('party_range_start_value');
      await createParty(interaction, templateId, { type: 'range', value: startDateValue });
      return;
    }

    if (interaction.customId.startsWith('job_modal_')) {
      const selectedJob = interaction.customId.replace('job_modal_', '');
      const guild = interaction.guild;
      const member = interaction.member;

      if (!guild || !member) {
        await interaction.reply({
          content: '❌ 서버 안에서만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const selectedRole = guild.roles.cache.find((role) => role.name === selectedJob);
      if (!selectedRole) {
        await interaction.reply({
          content: `❌ 서버에 '${selectedJob}' 역할이 없어요.`,
          ephemeral: true,
        });
        return;
      }

      const jobRoles = guild.roles.cache.filter((role) => jobs.includes(role.name));
      const nickname = interaction.fields.getTextInputValue('job_nickname').trim();
      const nextNickname = `${selectedJob}ㅣ${nickname}`.slice(0, 32);

      try {
        const guildMember = await guild.members.fetch(interaction.user.id);

        await guildMember.roles.remove(jobRoles);
        await guildMember.roles.add(selectedRole);

        let nicknameChanged = false;
        let nicknameReason = '';

        if (!guildMember.manageable) {
          nicknameReason = '봇 역할이 해당 멤버보다 낮거나 별명 변경 권한이 없어서 별명은 바꾸지 못했어요.';
        } else {
          try {
            await guildMember.setNickname(nextNickname);
            nicknameChanged = true;
          } catch (error) {
            console.error('별명 변경 중 오류:', error);
            nicknameReason = '역할은 변경됐지만 별명 변경 권한이 없어서 별명은 바꾸지 못했어요.';
          }
        }

        const content = nicknameChanged
          ? `✅ 직업이 **${selectedJob}**으로 설정됐고 별명을 **${nextNickname}**로 변경했어요.`
          : `✅ 직업이 **${selectedJob}**으로 설정됐어요. ${nicknameReason}`;

        await interaction.reply({
          content,
          ephemeral: true,
        });
      } catch (error) {
        console.error('직업/닉네임 변경 중 오류:', error);
        await interaction.reply({
          content: '❌ 직업 또는 닉네임 변경 중 오류가 발생했어요. 봇에 역할 관리와 별명 변경 권한이 있는지 확인해 주세요.',
          ephemeral: true,
        });
      }
    }

    return;
  }

  if (!interaction.isButton()) {
    return;
  }

  if (interaction.customId === 'memo_create') {
    await interaction.showModal(createMemoModal());
    return;
  }

  if (interaction.customId === 'inquiry_create') {
    await interaction.showModal(createInquiryModal());
    return;
  }

  if (interaction.customId === 'party_create_rudra') {
    await replyToInteraction(interaction, {
      content: '파티 일정 입력 방식을 선택해 주세요.',
      components: createPartyScheduleTypeRow('rudra'),
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === 'party_create_purification') {
    await replyToInteraction(interaction, {
      content: '파티 일정 입력 방식을 선택해 주세요.',
      components: createPartyScheduleTypeRow('purification'),
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === 'party_create_muspel') {
    await replyToInteraction(interaction, {
      content: '파티 일정 입력 방식을 선택해 주세요.',
      components: createPartyScheduleTypeRow('muspel'),
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId.startsWith('party_schedule_date_')) {
    const templateId = interaction.customId.replace('party_schedule_date_', '');
    await showPartyDatePicker(interaction, templateId, 'date');
    return;
  }

  if (interaction.customId.startsWith('party_schedule_range_')) {
    const templateId = interaction.customId.replace('party_schedule_range_', '');
    await showPartyDatePicker(interaction, templateId, 'range');
    return;
  }

  if (interaction.customId.startsWith('party_pick_quick_')) {
    const parts = interaction.customId.replace('party_pick_quick_', '').split('_');
    const mode = parts[0];
    const templateId = parts[1];
    const presetKey = parts.slice(2).join('_');
    const preset = getPartyQuickPreset(presetKey);

    if (!preset) {
      await replyToInteraction(interaction, {
        content: '선택한 빠른 일정 정보를 찾지 못했어요.',
        ephemeral: true,
      });
      return;
    }

    await createParty(interaction, templateId, { type: mode, value: preset.schedule });
    return;
  }

  if (interaction.customId.startsWith('party_apply_')) {
    const roleKey = interaction.customId.replace('party_apply_', '');
    await applyToParty(interaction, roleKey);
    return;
  }

  if (interaction.customId === 'party_cancel') {
    await cancelPartyApplication(interaction);
    return;
  }

  if (interaction.customId === 'party_close') {
    const party = getPartyByMessageId(interaction.message.id);

    if (!party) {
      await replyToInteraction(interaction, {
        content: '❌ 파티 정보를 찾을 수 없어요.',
        ephemeral: true,
      });
      return;
    }

    if (interaction.user.id !== party.creatorId) {
      await replyToInteraction(interaction, {
        content: '❌ 파티장만 신청 마감을 누를 수 있어요.',
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await replyToInteraction(interaction, {
        content: '❌ 서버 안에서만 사용할 수 있어요.',
        ephemeral: true,
      });
      return;
    }

    if (party.status === 'closed') {
      await replyToInteraction(interaction, {
        content: '❌ 이미 마감된 파티예요.',
        ephemeral: true,
      });
      return;
    }

    await closePartyFromButton(interaction, guild, party);
    return;
  }

  if (!interaction.customId.startsWith('job_')) {
    return;
  }

  const selectedJob = interaction.customId.replace('job_', '');
  await interaction.showModal(createJobNicknameModal(selectedJob));
});

async function startBot() {
  try {
    await registerCommands();
    console.log('슬래시 명령어 등록 완료!');

    await client.login(token);
  } catch (error) {
    console.error('봇 시작 중 오류가 발생했어요:', error);
  }
}

client.on(Events.Error, (error) => {
  console.error('클라이언트 오류:', error);
});

startBot();
function getCurrentKstDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
}

function getCurrentWeekWednesday(baseDate) {
  const diff = (baseDate.getDay() - 3 + 7) % 7;
  return addDays(baseDate, -diff);
}

function createPartyWeekPresets() {
  const today = getCurrentKstDate();
  const thisWeek = getPartyWeekRange(today);
  const nextWeek = getPartyWeekRange(addDays(thisWeek.startDate, 7));

  return [
    {
      key: 'this_week',
      label: '이번주',
      schedule: thisWeek,
    },
    {
      key: 'next_week',
      label: '다음주',
      schedule: nextWeek,
    },
  ];
}

function buildPartyDatePickerContent() {
  const presets = createPartyWeekPresets();
  const presetLines = presets.map((preset) => `- ${preset.label}: ${preset.schedule.label}`).join('\n');
  return `파티 일정을 선택해 주세요.\n${presetLines}\n선택한 일정은 화요일이 지나면 자동으로 마감돼요.`;
}

function createPartyDatePickerComponents(templateId, mode) {
  const quickButtons = createPartyWeekPresets().map((preset, index) =>
    new ButtonBuilder()
      .setCustomId(`party_pick_quick_${mode}_${templateId}_${preset.key}`)
      .setLabel(preset.label)
      .setStyle(index === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  return [
    new ActionRowBuilder().addComponents(...quickButtons),
  ];
}

function getPartyQuickPreset(presetKey) {
  return createPartyWeekPresets().find((preset) => preset.key === presetKey) || null;
}

async function showPartyDatePicker(interaction, templateId, mode) {
  const basePayload = {
    content: buildPartyDatePickerContent(),
    components: createPartyDatePickerComponents(templateId, mode),
  };

  await replyToInteraction(interaction, {
    ...basePayload,
    ephemeral: true,
  });
}
