import type { ImageMetadata } from 'astro';
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
  footerCardImage?: string;
}

export const hero = {
  name: 'AYANA YAMAZAKI',
  title: 'Product Builder',
};

export const caseStudies = [
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
    footerImage: panel01.src,
    footerCardImage: '/images/materials/footer-gem.webp',
  },
  {
    number: '02',
    title: 'Decide What to Build',
    pageTitle: 'Decide What to Build',
    metaDescription: '現場の事実から、作るべきものと順序を決める。',
    text: '調査と事業課題から、\n作るべきものと順序を決める',
    action: 'View Case Study',
    href: '/decide-what-to-build',
    image: panel02,
    alt: 'Dental product interface prototypes',
    footerDescription: '現場の事実から、作るべきものと順序を決める。',
    footerImage: '/images/reposaku-report-hero.jpg',
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
    footerImage: '/images/medical-ui/hero-interaction.gif',
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
    footerImage: panel03.src,
  },
] satisfies readonly CaseStudy[];

export const getCaseStudy = (href: string) => {
  const caseStudy = caseStudies.find((item) => item.href === href);

  if (!caseStudy) throw new Error(`Case study is not registered: ${href}`);
  return caseStudy;
};

export const about = {
  label: 'About',
  description: [
    '山崎 文菜　Ayana Yamazaki',
    '複雑な現場を翻訳し、動くプロダクトへと落とし込むプロダクトデザイナーです。',
    '農業やカスタマーサクセス領域のプロダクトに、立ち上げ期から携わってきました。現場に入り、業務や制約を理解するところから、課題の定義、ロードマップの検討、プロトタイピング、UI設計までを横断して担います。現在はAIとコードを活用し、画面だけでなく仕様そのものを、触れて検証できる形で設計しています。',
    '2021年に東京から北海道へ移住。製造業、農業、医療、鉄道など、複雑な業務と現場固有の制約を持つBtoBプロダクトを中心に活動しています。',
  ],
  profileImage: '/images/ayana-yamazaki.jpg',
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
