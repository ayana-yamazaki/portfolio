import type { ImageMetadata } from 'astro';
import type { Locale } from '../i18n/locale';
import panel01 from '../../img/panel01.png';
import panel02 from '../../img/panel02.png';
import panel03 from '../../img/panel03.png';

export interface CaseStudy {
  number: string;
  title: string;
  pageTitle: string;
  metaDescription: string;
  text: string;
  action: string;
  href: string;
  image: ImageMetadata | null;
  alt: string;
  footerDescription: string;
  footerImage?: string;
  footerImageSet?: {
    base: string;
    widths: number[];
    width: number;
    height: number;
  };
  footerCardImage?: string;
}

export const hero = {
  name: 'AYANA YAMAZAKI',
  title: 'Product Builder',
};

const caseStudiesJa = [
  {
    number: '01',
    title: 'Reframe the Problem',
    pageTitle: 'Reposaku',
    metaDescription: 'レポサク — From the Field to the Product',
    text: '現場を理解し、\nプロダクトの前提を変える',
    action: 'View Case Study',
    href: '/reframe-the-problem',
    image: panel01,
    alt: 'Working with soil in the field',
    footerDescription: '前提を疑い、現場から解くべき問題を定める。',
    footerImageSet: {
      base: '/images/optimized/panel01',
      widths: [480, 768, 1020],
      width: 1020,
      height: 1500,
    },
    footerCardImage: '/images/materials/footer-gem.webp',
  },
  {
    number: '02',
    title: 'Decide What to Build',
    pageTitle: 'Decide What to Build',
    metaDescription: '約300件の要望を7つの開発テーマへ整理し、1年間の開発ロードマップを策定。',
    text: '約300件の要望を、\n7つの開発テーマへ',
    action: 'View Case Study',
    href: '/decide-what-to-build',
    image: panel02,
    alt: '日報の手書きメモとスマートフォンのプロダクト画面',
    footerDescription: '経営・顧客・現場のアイデアを、事業の成長順序へ変える。',
    footerImageSet: {
      base: '/images/optimized/reposaku-report-hero',
      widths: [640, 1200, 1920],
      width: 2496,
      height: 1800,
    },
  },
  {
    number: '03',
    title: 'Prototype and Iterate',
    pageTitle: 'Prototype and Iterate',
    metaDescription: '歯科医師と試作を重ね、紙より速い操作を実現',
    text: '試作と検証を重ね、\n操作性を研ぎ澄ます',
    action: 'View Case Study',
    href: '/prototype-and-iterate',
    image: null,
    alt: '',
    footerDescription: '歯科医師と試作を重ね、紙より速い操作へ磨き込む。',
    footerImage: '/images/medical-ui/hero-interaction-poster.webp',
  },
  {
    number: '04',
    title: 'Build AI-Native',
    pageTitle: 'Build AI-Native',
    metaDescription: 'Figmaでは見えない仕様の穴を、コードで潰す。',
    text: 'AIとコードで、\n仕様の曖昧さを実装前に潰す',
    action: 'View Case Study',
    href: '/build-ai-native',
    image: panel03,
    alt: 'Building a product in the terminal',
    footerDescription: 'AIとコードで、仕様の曖昧さを実装前に潰す。',
    footerImageSet: {
      base: '/images/optimized/panel03',
      widths: [480, 768, 1020],
      width: 1020,
      height: 1500,
    },
  },
] satisfies readonly CaseStudy[];

const caseStudiesEn = [
  {
    number: '01',
    title: 'Reframe the Problem',
    pageTitle: 'Reposaku',
    metaDescription: 'Reposaku — Reframing a product through field research',
    text: 'Understand the field,\nthen reframe the product',
    action: 'View Case Study',
    href: '/reframe-the-problem',
    image: panel01,
    alt: 'Working with soil in the field',
    footerDescription: 'Question assumptions and define the right problem from the field.',
    footerImageSet: {
      base: '/images/optimized/panel01',
      widths: [480, 768, 1020],
      width: 1020,
      height: 1500,
    },
    footerCardImage: '/images/materials/footer-gem.webp',
  },
  {
    number: '02',
    title: 'Decide What to Build',
    pageTitle: 'Decide What to Build',
    metaDescription: 'Turning field evidence and business goals into a product roadmap',
    text: 'Turn research and business goals\ninto a product roadmap',
    action: 'View Case Study',
    href: '/decide-what-to-build',
    image: panel02,
    alt: 'Daily reporting product interface',
    footerDescription: 'Use field evidence to decide what to build, and in what order.',
    footerImageSet: {
      base: '/images/optimized/reposaku-report-hero',
      widths: [640, 1200, 1920],
      width: 2496,
      height: 1800,
    },
  },
  {
    number: '03',
    title: 'Prototype and Iterate',
    pageTitle: 'Prototype and Iterate',
    metaDescription: 'Iterating with dentists to create an interface faster than paper',
    text: 'Prototype, test,\nand refine every interaction',
    action: 'View Case Study',
    href: '/prototype-and-iterate',
    image: null,
    alt: '',
    footerDescription: 'Iterate with dentists until the experience is faster than paper.',
    footerImage: '/images/medical-ui/hero-interaction-poster.webp',
  },
  {
    number: '04',
    title: 'Build AI-Native',
    pageTitle: 'Build AI-Native',
    metaDescription: 'Using code to expose specification gaps that static design cannot reveal',
    text: 'Use AI and code\nto resolve ambiguity early',
    action: 'View Case Study',
    href: '/build-ai-native',
    image: panel03,
    alt: 'Building a product in the terminal',
    footerDescription: 'Use AI and code to resolve ambiguity before implementation.',
    footerImageSet: {
      base: '/images/optimized/panel03',
      widths: [480, 768, 1020],
      width: 1020,
      height: 1500,
    },
  },
] satisfies readonly CaseStudy[];

export const getCaseStudies = (locale: Locale = 'ja') =>
  locale === 'en' ? caseStudiesEn : caseStudiesJa;

export const getCaseStudy = (href: string, locale: Locale = 'ja') => {
  const caseStudy = getCaseStudies(locale).find((item) => item.href === href);

  if (!caseStudy) throw new Error(`Case study is not registered: ${href}`);
  return caseStudy;
};

const aboutJa = {
  label: 'About',
  description: [
    '山崎 文菜　Ayana Yamazaki',
    '複雑な現場を翻訳し、動くプロダクトへと落とし込むプロダクトビルダー・デザイナーです。',
    '農業やカスタマーサクセス領域のプロダクトに、立ち上げ期から携わってきました。現場に入り、業務や制約を理解するところから、課題の定義、ロードマップの検討、プロトタイピング、UI設計までを横断して担います。現在はAIとコードを活用し、画面だけでなく仕様そのものを、触れて検証できる形で設計しています。',
    '2021年に東京から北海道へ移住。製造業、農業、医療、鉄道など、複雑な業務と現場固有の制約を持つBtoBプロダクトを中心に活動しています。',
  ],
  experience: [
    { period: '2026 - Present', organization: 'キャディ株式会社', description: '製造業AIプラットフォームのプロダクトデザインを担当。Claude CodeとStorybookを使ったAI-Nativeな仕様設計にも取り組む。' },
    { period: '2022 - 2025', organization: 'エゾウィン株式会社', description: '1人目のデザイナーとして、農業法人向けプロダクトを担当。ユーザーリサーチからUX・UI、オンボーディングまでをリードし、グッドデザイン金賞を受賞。' },
    { period: '2021 - 2022', organization: 'フリーランス', description: 'BtoBプロダクトのUX・UIデザインを担当。' },
    { period: '2019 - 2021', organization: 'HiCustomer株式会社', description: '1人目のデザイナーとして、カスタマーサクセス向けSaaSを担当。' },
    { period: '2017 - 2019', organization: '株式会社日立製作所 研究開発グループ', description: '鉄道システムのユーザーリサーチとUI/UXデザインを担当。新機能の創出と受注に貢献し、特許・意匠を取得。' },
    { period: '2017', organization: '金沢美術工芸大学 プロダクトデザイン学部 卒業' },
    { period: '2014 - 2015', organization: 'トロント大学ラボ', description: '大学を1年休学し、多国籍チームでアプリを開発。' },
  ],
};

const aboutEn = {
  label: 'About',
  description: [
    'Ayana Yamazaki',
    'I am a product designer who translates complex frontline operations into products people can use.',
    'I have helped build products in agriculture and customer success from their earliest stages. My work spans field research, understanding operational constraints, problem definition, roadmap planning, prototyping, and UI design. Today, I use AI and code to make not only screens but product behavior tangible and testable.',
    'I moved from Tokyo to Hokkaido in 2021. I focus on B2B products shaped by complex workflows and domain-specific constraints, including manufacturing, agriculture, healthcare, and rail.',
  ],
  experience: [
    { period: '2026 - Present', organization: 'CADDi Inc.', description: 'Product design for an AI platform for manufacturing. I also explore AI-native specification design using Claude Code and Storybook.' },
    { period: '2022 - 2025', organization: 'EZOWIN Inc.', description: 'Joined as the first designer for an agricultural operations product. Led user research, UX and UI design, and onboarding, contributing to a Good Design Gold Award.' },
    { period: '2021 - 2022', organization: 'Freelance', description: 'Designed UX and UI for B2B products.' },
    { period: '2019 - 2021', organization: 'HiCustomer Inc.', description: 'Joined as the first designer for a customer success SaaS product.' },
    { period: '2017 - 2019', organization: 'Hitachi, Ltd., Research & Development Group', description: 'Led user research and UI/UX design for railway systems. Contributed to new product capabilities and contracts, and was granted patents and design rights.' },
    { period: '2017', organization: 'B.A. in Product Design, Kanazawa College of Art' },
    { period: '2014 - 2015', organization: 'University of Toronto Lab', description: 'Took a year away from university to build an app with a multinational team.' },
  ],
};

export const getAbout = (locale: Locale = 'ja') => locale === 'en' ? aboutEn : aboutJa;
