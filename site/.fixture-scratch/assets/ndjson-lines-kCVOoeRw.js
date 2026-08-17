async function*e(e){let t=e.getReader(),n=new TextDecoder,r=``,i=!1;try{for(;;){let{done:e,value:i}=await t.read();if(e)break;r+=n.decode(i,{stream:!0});let a=r.indexOf(`
`);for(;a!==-1;){let e=r.slice(0,a).trim();r=r.slice(a+1),e.length>0&&(yield e),a=r.indexOf(`
`)}}i=!0;let e=r.trim();e.length>0&&(yield e)}finally{i||t.cancel().catch(()=>{})}}export{e as t};