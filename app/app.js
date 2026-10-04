import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const S = { cbld:null, cskh:null, cases:[], current:null, sessionId:crypto.randomUUID() };
const q = id => document.getElementById(id);
const show = id => ['selector','workspace','detail'].forEach(x=>q(x).classList.toggle('active',x===id));
const esc = v => String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

async function ensureAuth(){
  const { data:{session} } = await supabase.auth.getSession();
  if(session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if(error) throw new Error('Cần bật Anonymous Sign-Ins trên Supabase.');
}
async function rpc(name,params={}){ await ensureAuth(); const {data,error}=await supabase.rpc(name,params); if(error) throw error; return data; }

async function init(){
  const rows = await rpc('csh_get_workspace_selectors');
  q('cbld').innerHTML='<option value="">Chọn CBLĐ</option>'+rows.map(x=>`<option>${esc(x.cbld_name)}</option>`).join('');
  q('cbld').onchange=()=>{
    S.cbld=q('cbld').value||null; S.cskh=null; q('enter').disabled=true;
    const names=(rows.find(x=>x.cbld_name===S.cbld)?.cskh_names)||[];
    q('cskh').disabled=!S.cbld;
    q('cskh').innerHTML='<option value="">Chọn CSKH</option>'+names.map(x=>`<option>${esc(x)}</option>`).join('');
  };
  q('cskh').onchange=()=>{ S.cskh=q('cskh').value||null; q('enter').disabled=!(S.cbld&&S.cskh); };
}

async function load(mode='active'){
  const fn=mode==='completed'?'csh_get_completed_cases':'csh_get_workspace';
  S.cases=await rpc(fn,{p_cbld:S.cbld,p_cskh:S.cskh})||[];
  renderList();
}
function renderList(){
  q('who').textContent=S.cskh; q('supervisor').textContent=`CBLĐ: ${S.cbld}`;
  q('count-active').textContent=S.cases.length;
  q('count-issue').textContent=S.cases.filter(x=>x.need_cbld_support||['NEW','IN_PROGRESS'].includes(x.issue_status)).length;
  q('count-overdue').textContent=S.cases.filter(x=>Number(x.computed_days_to_cktt)<0).length;
  q('cases').innerHTML=S.cases.map(c=>{
    const d=Number(c.computed_days_to_cktt); const t=d<0?`Quá hạn ${Math.abs(d)} ngày`:`T-${d}`;
    return `<article class="case-card" data-shop="${esc(c.shop_id)}"><div class="top"><h3>${esc(c.shop_id)}</h3><span class="badge">${esc(t)}</span></div><div class="meta">HĐT2: ${esc(branch(c.computed_hdt2_branch))}</div><div class="next">${esc(c.computed_next_action||'Chưa xác định')}</div>${c.computed_warning_code?`<div class="warn ${esc(c.computed_warning_level)}">${esc(warning(c.computed_warning_code))}</div>`:''}</article>`;
  }).join('');
  document.querySelectorAll('.case-card').forEach(el=>el.onclick=()=>openCase(el.dataset.shop));
}

async function openCase(shopId){ S.current=await rpc('csh_get_case',{p_shop_id:shopId}); const c=S.current.case||{}; q('detail-shop').textContent=shopId; q('detail-state').textContent=c.computed_next_action||''; renderCase(c); show('detail'); }
function opt(field,label,value,items){ return `<div class="field"><label>${esc(label)}</label><select data-field="${field}"><option value="">—</option>${items.map(([v,t])=>`<option value="${v}" ${String(value??'')===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`; }
function renderCase(c){
  q('detail-body').innerHTML=`<section class="section"><h2>Tình trạng hiện tại</h2><div class="readonly">Cam kết tiền thuê: ${esc(c.cktt_end_date||'—')}</div><div class="readonly">HĐT2: ${esc(branch(c.computed_hdt2_branch))}</div><div class="readonly">Việc tiếp theo: ${esc(c.computed_next_action||'—')}</div></section><section class="section"><h2>Cập nhật xử lý</h2>${opt('handover_check_status','Kiểm tra mặt bằng',c.handover_check_status,[['NOT_CHECKED','Chưa kiểm tra'],['CHECKED','Đã kiểm tra']])}${opt('handover_condition','So với điều kiện bàn giao khai thác',c.handover_condition,[['BELOW_STANDARD','Dưới'],['MEETS_STANDARD','Đạt'],['ABOVE_STANDARD','Tốt hơn']])}${opt('repair_status','Xử lý mặt bằng',c.repair_status,[['NOT_REQUIRED','Không cần'],['RECORDED','Đã ghi nhận'],['IN_REPAIR','Đang sửa chữa'],['COMPLETED','Đã hoàn thiện']])}${opt('debt_status','Công nợ',c.debt_status,[['UNKNOWN','Chưa xác định'],['PENDING','Đang xử lý'],['CLEARED','Đã xử lý'],['NOT_APPLICABLE','Không áp dụng']])}${opt('document_status','Hồ sơ',c.document_status,[['UNKNOWN','Chưa xác định'],['PENDING','Đang xử lý'],['COMPLETE','Hoàn tất'],['NOT_APPLICABLE','Không áp dụng']])}${opt('bql_confirmation_status','Ban quản lý xác nhận',c.bql_confirmation_status,[['PENDING','Chưa'],['CONFIRMED','Đã xác nhận'],['NOT_APPLICABLE','Không áp dụng']])}</section><section class="section"><h2>Vướng mắc / đề xuất</h2><div class="field"><label>Loại vướng mắc</label><input data-field="issue_type" value="${esc(c.issue_type||'')}"></div><div class="field"><label>Nội dung</label><textarea data-field="issue_text">${esc(c.issue_text||'')}</textarea></div><div class="field"><label>Đề xuất xử lý</label><textarea data-field="proposal_text">${esc(c.proposal_text||'')}</textarea></div>${opt('issue_priority','Mức độ',c.issue_priority,[['NORMAL','Bình thường'],['SOON','Cần xử lý sớm'],['URGENT','Khẩn']])}${opt('need_cbld_support','Cần CBLĐ hỗ trợ',String(c.need_cbld_support),[['false','Không'],['true','Có']])}</section><div class="actions"><button id="save">Lưu cập nhật</button></div>`;
  q('save').onclick=saveCase;
}
async function saveCase(){
  const changes={}; document.querySelectorAll('#detail-body [data-field]').forEach(el=>{ if(el.value!=='') changes[el.dataset.field]=el.dataset.field==='need_cbld_support'?el.value==='true':el.value; });
  await rpc('csh_update_case',{p_shop_id:S.current.case.shop_id,p_cbld:S.cbld,p_cskh:S.cskh,p_session_id:S.sessionId,p_changes:changes}); await load(); show('workspace');
}
function branch(v){return ({BEFORE_CKTT:'Hết trước Cam kết tiền thuê',SAME_AS_CKTT:'Hết cùng Cam kết tiền thuê',AFTER_CKTT:'Còn hiệu lực sau Cam kết tiền thuê',NO_HDT2:'Không có HĐT2',DATA_EXCEPTION:'Cần rà soát dữ liệu'})[v]||'Chưa xác định';}
function warning(v){return ({HDT2_DATA_EXCEPTION:'Dữ liệu HĐT2 cần rà soát',CKTT_OVERDUE:'Đã quá hạn Cam kết tiền thuê',CBLD_SUPPORT_REQUIRED:'Cần CBLĐ hỗ trợ',NO_PROGRESS_10D:'Không có tiến triển 10 ngày',CKTT_T7:'Còn tối đa 7 ngày',CKTT_T15:'Còn tối đa 15 ngày'})[v]||v;}

q('enter').onclick=async()=>{await load();show('workspace');}; q('back').onclick=()=>show('selector'); q('detail-back').onclick=()=>show('workspace');
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=async()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');await load(b.dataset.filter==='completed'?'completed':'active');});
init().catch(e=>{console.error(e);alert(e.message||'Không tải được dữ liệu');});
