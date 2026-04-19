import{E as et,a as ot}from"./jspdf.plugin.autotable-CO4CE3FN.js";const y=document.getElementById("oa-form"),w=document.getElementById("oa-items-container"),nt=document.getElementById("oa-add-item"),at=document.getElementById("oa-item-tpl"),it=document.getElementById("oa-total-disp"),lt=document.getElementById("oa-words-disp"),rt=document.getElementById("oa-reset"),st=document.getElementById("oa-preview-btn"),h=document.getElementById("oa-dialog"),dt=document.getElementById("oa-dialog-close"),ct=document.getElementById("oa-preview-sheet"),j=document.getElementById("oa-company-toggle"),k=document.getElementById("oa-company-body"),H=document.getElementById("oa-date"),L="oa-invoice-draft",N=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],ut=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];function I(e){return e===0?"":e<20?N[e]:ut[Math.floor(e/10)]+(e%10?" "+N[e%10]:"")}function mt(e){if(e===0)return"";const o=Math.floor(e/100),i=e%100;return(o?N[o]+" Hundred":"")+(i?(o?" ":"")+I(i):"")}function D(e){if(e=Math.floor(Math.abs(e)),e===0)return"Zero Rupees Only";let o="";const i=Math.floor(e/1e7);e%=1e7;const t=Math.floor(e/1e5);e%=1e5;const n=Math.floor(e/1e3);return e%=1e3,i&&(o+=I(i)+" Crore "),t&&(o+=I(t)+" Lakh "),n&&(o+=I(n)+" Thousand "),e&&(o+=mt(e)+" "),o.trim()+" Rupees Only"}function G(e){return"Rs."+Math.round(e)+"/-"}function A(e){return"Rs. "+Math.round(e)+"/-"}function M(){const e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}function V(e){if(!e)return"";const[o,i,t]=e.split("-");return`${t}/${i}/${o}`}function s(e){const o=document.createElement("div");return o.textContent=e,o.innerHTML}function v(){return Array.from(w.querySelectorAll("[data-oa-item]"))}function Y(){v().forEach(function(e,o){const i=e.querySelector(".oa-item-num");i&&(i.textContent=o+1+")")})}function p(){let e=0;return v().forEach(function(o){const i=parseFloat(o.querySelector(".oa-amt").value)||0;e+=i}),e=Math.round(e),it.textContent=A(e),lt.textContent="Amount in words: "+D(e),e}function vt(e){e.querySelector(".oa-amt").addEventListener("input",p);const o=e.querySelector("[data-oa-remove]");o&&o.addEventListener("click",function(){v().length<=1||(e.remove(),Y(),p(),x())})}function S(e){const o=at.content.cloneNode(!0),i=o.querySelector("[data-oa-item]");if(e){const t=i.querySelector(".oa-desc"),n=i.querySelector(".oa-amt");t&&e.desc!=null&&(t.value=e.desc),n&&e.amt!=null&&(n.value=e.amt)}w.appendChild(o),vt(w.lastElementChild),Y(),p()}nt.addEventListener("click",function(){S(),x()});j.addEventListener("click",function(){const e=k.hidden;k.hidden=!e,j.setAttribute("aria-expanded",e?"true":"false")});let B=null;function x(){B&&clearTimeout(B),B=setTimeout(gt,300)}function z(){return{address:document.getElementById("oa-address").value,pan:document.getElementById("oa-pan").value,signatory:document.getElementById("oa-signatory").value,website:document.getElementById("oa-website").value,invNo:document.getElementById("oa-inv-no").value,date:document.getElementById("oa-date").value,toName:document.getElementById("oa-to-name").value,toProject:document.getElementById("oa-to-project").value,toCity:document.getElementById("oa-to-city").value,terms:document.getElementById("oa-terms").value,items:v().map(function(e){return{desc:e.querySelector(".oa-desc").value,amt:e.querySelector(".oa-amt").value}})}}function gt(){try{localStorage.setItem(L,JSON.stringify(z()))}catch{}}function ft(){try{const e=localStorage.getItem(L);if(!e)return!1;const o=JSON.parse(e),i=(t,n)=>{const u=document.getElementById(t);u&&n!=null&&(u.value=n)};return i("oa-address",o.address),i("oa-pan",o.pan),i("oa-signatory",o.signatory),i("oa-website",o.website),i("oa-inv-no",o.invNo),i("oa-date",o.date||M()),i("oa-to-name",o.toName),i("oa-to-project",o.toProject),i("oa-to-city",o.toCity),i("oa-terms",o.terms),Array.isArray(o.items)&&o.items.length?o.items.forEach(function(t){S(t)}):S(),p(),!0}catch{return!1}}const ht=`1) Payment should be done in the Name of "Orangy Ads"
2) 100% Payment in advance.
3) For Month of November, December 2025 and January 2026.`;function yt(){localStorage.removeItem(L),document.getElementById("oa-address").value=`686, Shop no - 3,
Shridhar Nilay Apts,
Bibwewadi - 411037`,document.getElementById("oa-pan").value="AVAPK3287C",document.getElementById("oa-signatory").value="Nilesh Kothari",document.getElementById("oa-website").value="www.orangyads.com",document.getElementById("oa-inv-no").value="",document.getElementById("oa-date").value=M(),document.getElementById("oa-to-name").value="",document.getElementById("oa-to-project").value="",document.getElementById("oa-to-city").value="",document.getElementById("oa-terms").value=ht,w.replaceChildren(),S(),p()}rt.addEventListener("click",function(){confirm("Reset all fields to defaults?")&&yt()});y.addEventListener("input",x);y.addEventListener("change",x);function pt(){const e=z(),o=v().reduce(function(u,a){return u+(parseFloat(a.querySelector(".oa-amt").value)||0)},0),i=Math.round(o),t=['<span class="oa-inv-to-name">'+s(e.toName)+"</span>"];e.toProject&&t.push("Project — "+s(e.toProject)),e.toCity&&t.push(s(e.toCity));const n=v().map(function(u,a){const r=u.querySelector(".oa-desc").value,m=parseFloat(u.querySelector(".oa-amt").value)||0;return`<tr>
      <td class="oa-td-particulars">${s(a+1+")  "+r)}</td>
      <td class="oa-td-rate">${s(G(m))}</td>
    </tr>`}).join("");return`
  <div class="oa-sheet">

    <!-- ▸ Split header: white logo left · orange info right -->
    <div class="oa-inv-header-band">
      <div class="oa-inv-header-logo-wrap">
        <img src="./orgadsclearlogo.png" class="oa-inv-logo" alt="OrangyAds" />
      </div>
      <div class="oa-inv-header-info-wrap">
        <div class="oa-inv-brand-tag">Digital Marketing Solutions</div>
        <div class="oa-inv-addr-top">${s(e.address).replace(/\n/g,"<br>")}</div>
      </div>
    </div>

    <!-- ▸ Divider line below header -->
    <div style="height:2px;background:linear-gradient(to right,#f47920 0%,#ffa040 50%,#f0f0f0 100%);margin:0 1.75rem;border-radius:2px;"></div>

    <!-- ▸ Body -->
    <div class="oa-sheet-body">

      <!-- Title + invoice meta -->
      <div class="oa-inv-title-row">
        <div class="oa-inv-title">INV<span>OICE</span></div>
        <div class="oa-inv-meta">
          <div class="oa-inv-meta-no">#&thinsp;${s(e.invNo)}</div>
          <div>Date &nbsp;·&nbsp; ${s(V(e.date))}</div>
        </div>
      </div>

      <!-- Bill to -->
      <div class="oa-inv-to-section">
        <div class="oa-inv-to-label">Bill To</div>
        ${t.join("<br>")}
      </div>

      <!-- Particulars table -->
      <table class="oa-inv-table">
        <thead>
          <tr>
            <th style="text-align:left;padding-left:0.85rem">Particulars</th>
            <th style="width:28%">Rate</th>
          </tr>
        </thead>
        <tbody>${n}</tbody>
        <tfoot>
          <tr class="oa-tr-total">
            <td class="oa-total-label-cell">Total Amount</td>
            <td class="oa-td-rate">${s(A(i))}</td>
          </tr>
          <tr class="oa-tr-words">
            <td colspan="2"><em>In words :</em>&ensp;${s(D(i))}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Terms + PAN -->
      <div class="oa-inv-bottom-row">
        <div class="oa-inv-terms">
          <span class="oa-inv-terms-head">Terms &amp; Conditions</span>${s(e.terms)}
        </div>
        <div class="oa-inv-pan-box">
          <span class="oa-inv-pan-label">PAN No.</span>
          ${s(e.pan)}
        </div>
      </div>

      <!-- Footer -->
      <div class="oa-inv-footer">
        <div class="oa-inv-footer-tagline">OrangyAds &nbsp;·&nbsp; Digital Marketing Solutions</div>
        <div>
          <div class="oa-inv-signatory">
            <strong>Authorised Signatory</strong><br>${s(e.signatory)}
          </div>
          <div class="oa-inv-website">${s(e.website)}</div>
        </div>
      </div>

    </div>

    <!-- ▸ Bottom wave accent -->
    <svg class="oa-inv-bottom-wave" viewBox="0 0 600 22" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" height="22" aria-hidden="true">
      <path d="M0,22 C100,4 200,18 320,10 C440,2 520,16 600,8 L600,22 Z" fill="#f47920" opacity="0.18"/>
      <path d="M0,22 C90,8 200,20 310,12 C420,4 510,18 600,10 L600,22 Z" fill="#f47920" opacity="0.35"/>
      <path d="M0,22 C80,12 190,22 300,14 C410,6 500,20 600,12 L600,22 Z" fill="#f47920" opacity="0.65"/>
      <path d="M0,22 C70,16 180,22 290,16 C400,10 490,22 600,16 L600,22 Z" fill="#f47920"/>
    </svg>

  </div>`}st.addEventListener("click",function(){y.reportValidity()&&(ct.innerHTML=pt(),h.showModal())});dt.addEventListener("click",function(){h.close()});h.addEventListener("click",function(e){e.target===h&&h.close()});async function St(){const e=z(),o=v().map(function(d){return{desc:d.querySelector(".oa-desc").value.trim(),amt:Math.round(parseFloat(d.querySelector(".oa-amt").value)||0)}}),i=o.reduce(function(d,c){return d+c.amt},0),t=new et({unit:"mm",format:"a4"}),n=t.internal.pageSize.getWidth(),u=t.internal.pageSize.getHeight(),a=15,r=[244,121,32],m=[26,26,46],C=[255,255,255],f=28;try{const c=await(await fetch("./orgadsclearlogo.png")).blob(),X=await new Promise(function(Q){const q=new FileReader;q.onload=function(tt){Q(tt.target.result)},q.readAsDataURL(c)});t.addImage(X,"PNG",a,5,44,18)}catch{}t.setFont("helvetica","bold"),t.setFontSize(6),t.setTextColor(...r),t.text("DIGITAL MARKETING SOLUTIONS",n-a,9,{align:"right"}),t.setFont("helvetica","normal"),t.setFontSize(8),t.setTextColor(80,80,80);let O=14;e.address.split(`
`).forEach(function(d){t.text(d.trim(),n-a,O,{align:"right"}),O+=4}),t.setDrawColor(...r),t.setLineWidth(.7),t.line(a,f,n*.55,f),t.setDrawColor(220,220,220),t.setLineWidth(.4),t.line(n*.55,f,n-a,f);let l=f+10;t.setFont("helvetica","bold"),t.setFontSize(22),t.setTextColor(...m),t.text("INV",a,l);const U=t.getTextWidth("INV");t.setTextColor(...r),t.text("OICE",a+U,l),t.setFontSize(11),t.setTextColor(...r),t.text("# "+e.invNo,n-a,l-3,{align:"right"}),t.setFont("helvetica","normal"),t.setFontSize(9),t.setTextColor(100,100,120),t.text("Date  ·  "+V(e.date),n-a,l+3,{align:"right"}),l+=4,t.setDrawColor(...r),t.setLineWidth(.6),t.line(a,l,n-a,l),l+=7;const b=[e.toName];e.toProject&&b.push("Project — "+e.toProject),e.toCity&&b.push(e.toCity);const T=5+b.length*4.8+4;t.setFillColor(255,249,243),t.setDrawColor(...r),t.setLineWidth(0),t.roundedRect(a,l,n-2*a,T,2,2,"F"),t.setFillColor(...r),t.roundedRect(a,l,2,T,1,1,"F"),t.setFont("helvetica","bold"),t.setFontSize(6.5),t.setTextColor(...r),t.text("BILL TO",a+6,l+4);let R=l+9;b.forEach(function(d,c){t.setFont("helvetica",c===0?"bold":"normal"),t.setFontSize(c===0?10:8.5),t.setTextColor(c===0?20:80,c===0?20:80,c===0?20:80),t.text(d,a+6,R),R+=4.8}),l+=T+7;const W=130,K=n-2*a-W,Z=o.map(function(d,c){return[{content:c+1+")  "+d.desc,styles:{halign:"left",valign:"middle"}},{content:G(d.amt),styles:{halign:"center",valign:"middle",fontStyle:"bold"}}]});ot(t,{startY:l,head:[[{content:"Particulars",styles:{halign:"left"}},{content:"Rate",styles:{halign:"center"}}]],body:Z,foot:[[{content:"TOTAL AMOUNT",styles:{halign:"right",fontStyle:"bold",fontSize:9,fillColor:C,textColor:m,lineColor:[230,210,195],lineWidth:.25}},{content:A(i),styles:{halign:"center",fontStyle:"bold",fontSize:13,fillColor:m,textColor:[255,169,77],lineWidth:0}}],[{content:"In words :  "+D(i),colSpan:2,styles:{halign:"center",fontSize:8,fontStyle:"italic",fillColor:[253,246,239],textColor:[100,100,120],lineColor:[230,210,195],lineWidth:.25}}]],theme:"grid",headStyles:{fillColor:r,textColor:C,fontStyle:"bold",fontSize:10.5,lineWidth:0,minCellHeight:9},bodyStyles:{fillColor:C,textColor:[30,30,30],fontSize:9.5,lineColor:[230,210,195],lineWidth:.25,minCellHeight:16},alternateRowStyles:{fillColor:[253,246,239]},footStyles:{fillColor:C,textColor:m,fontSize:9,lineWidth:0,minCellHeight:9},columnStyles:{0:{cellWidth:W},1:{cellWidth:K}},margin:{left:a,right:a}}),l=t.lastAutoTable.finalY+8;const P=t.splitTextToSize(e.terms,n-2*a-45),E=40,$=16,F=n-a-E;t.setFillColor(247,247,249),t.setDrawColor(220,220,228),t.setLineWidth(.3),t.roundedRect(F,l,E,$,3,3,"FD"),t.setFont("helvetica","bold"),t.setFontSize(6.5),t.setTextColor(170,170,180),t.text("PAN NO.",F+E/2,l+5,{align:"center"}),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(...m),t.text(e.pan,F+E/2,l+12,{align:"center"}),t.setFont("helvetica","bold"),t.setFontSize(7.5),t.setTextColor(...r),t.text("TERMS & CONDITIONS",a,l+4),t.setFont("helvetica","normal"),t.setFontSize(7.5),t.setTextColor(80,80,90),t.text(P,a,l+9),l=Math.max(l+$+6,l+P.length*3.8+14);const g=Math.max(l,u-28);t.setDrawColor(240,228,216),t.setLineWidth(.4),t.line(a,g,n-a,g),t.setFont("helvetica","bold"),t.setFontSize(6.5),t.setTextColor(200,200,210),t.text("ORANGYADS  ·  DIGITAL MARKETING SOLUTIONS",a,g+6),t.setFont("helvetica","bold"),t.setFontSize(9.5),t.setTextColor(...m),t.text("Authorised Signatory",n-a,g+5,{align:"right"}),t.setFont("helvetica","normal"),t.setFontSize(9),t.setTextColor(60,60,60),t.text(e.signatory,n-a,g+11,{align:"right"}),t.setFont("helvetica","bold"),t.setFontSize(8),t.setTextColor(...r),t.text(e.website,n-a,g+17,{align:"right"});const J=u-4;t.setFillColor(...r),t.setDrawColor(...r),t.lines([[n*.22,-3.5,n*.28,-3.5,n*.5,-1.5],[n*.22,1.5,n*.28,3.5,n*.5,1.5],[0,4],[-n,0]],0,J,[1,1],"F",!0);const _=(e.invNo||"invoice").replace(/[^\w\-]+/g,"_");t.save("orangyads-invoice-"+_+".pdf")}y.addEventListener("submit",async function(e){e.preventDefault(),y.reportValidity()&&await St()});ft()||(H&&(H.value=M()),S());
