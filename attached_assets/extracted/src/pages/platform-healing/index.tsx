import dynamic from 'next/dynamic';
const Page = dynamic(()=>import('../../app/platform-healing/page'), { ssr:false });
export default Page;
