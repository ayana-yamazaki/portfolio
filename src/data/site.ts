export const hero = {
  name: 'AYANA YAMAZAKI',
  title: 'Product Builder',
};

export const pillars = [
  {
    number: '01',
    title: 'Reframe the Problem',
    text: '前提を疑い、解くべき問題を定める。',
    action: 'View Case Study',
    href: '/reposaku',
    image: panel01,
    alt: 'Working with soil in the field',
  },
  {
    number: '02',
    title: 'Decide What to Build',
    text: '調査と事業課題から、作るべきものと順序を決める。',
    action: 'View Case Study',
    href: '/decide-what-to-build',
    image: panel02,
    alt: 'Dental product interface prototypes',
  },
  {
    number: '03',
    title: 'Prototype and Iterate',
    text: '試作と検証を重ね、0.1秒単位で操作を削り切る。',
    action: 'View Case Study',
    href: '/prototype-and-iterate',
    image: null,
    alt: '',
  },
  {
    number: '04',
    title: 'Build AI-Native',
    text: 'AIとコードで、仕様の曖昧さを実装前に潰す。',
    action: 'View Projects',
    href: '/#projects',
    image: panel03,
    alt: 'Building a product in the terminal',
  },
];

export const about = {
  label: 'About',
  description: [
    '山崎文菜（やまざき あやな）。複雑な現場を理解し、作るべきものを決め、触れる形まで持っていくプロダクトデザイナーです。',
    '農業やカスタマーサクセスのプロダクトの立ち上げから参画。画面を作るだけでなく、ユーザーリサーチ、課題定義、ロードマップ、プロトタイピングまで担います。現在はAIとコードを使い、仕様そのものを触れる形で設計しています。',
    '2021年に東京から北海道へ移住。製造業、農業、医療、鉄道など、現場の制約が大きいBtoB領域を中心に活動しています。',
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
import panel01 from '../../img/panel01.png';
import panel02 from '../../img/panel02.png';
import panel03 from '../../img/panel03.png';
