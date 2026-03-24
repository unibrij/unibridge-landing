const tg = window.Telegram?.WebApp
if(tg){ tg.expand() }

let sessionId = null
let routeId = null
let settlementId = null
let poller = null
let confirming = false
let currentRoute = null

const sendBtn = document.getElementById("sendBtn")
const continueBtn = document.getElementById("continueBtn")
const statusBox = document.getElementById("status")
const summaryBox = document.getElementById("summary")
const pixBox = document.getElementById("pixBox")
const taxBox = document.getElementById("taxBox")

function setStep(n){

for(let i=1;i<=5;i++){
document.getElementById("step"+i).classList.remove("active")
}

document.getElementById("step"+n).classList.add("active")

}

function setStatus(msg,type){

statusBox.innerText = msg
statusBox.className = ""

if(type === "success"){ statusBox.classList.add("status-success") }
if(type === "error"){ statusBox.classList.add("status-error") }

}

function formatAmount(value,symbol=""){
const n = Number(value)
if(!Number.isFinite(n)) return "-"
return `${n.toFixed(2)} ${symbol}`
}

function updateSummaryFromQuote(route){

document.getElementById("sumFunding").innerText =
formatAmount(route.funding_amount,route.asset || "USDT")

document.getElementById("sumCountry").innerText =
document.getElementById("country").value

document.getElementById("sumRoute").innerText =
`${(route.payout_rail || "PIX").toUpperCase()} Instant`

summaryBox.style.display = "block"

}

async function api(path,payload){

const r = await fetch("/api/proxy?endpoint=" + encodeURIComponent(path),{
method:"POST",
headers:{ "content-type":"application/json" },
body:JSON.stringify(payload || {})
})

const text = await r.text()

let data

try{
data = JSON.parse(text)
}catch{
data = { raw:text }
}

if(!r.ok){
throw new Error(data.error || "api_error")
}

return data

}

async function getStatus(settlementIdValue){

const r = await fetch("/api/proxy?endpoint=settlement/status&settlement_id=" + encodeURIComponent(settlementIdValue))

const text = await r.text()

let data

try{
data = JSON.parse(text)
}catch{
data = { raw:text }
}

if(!r.ok){
throw new Error(data.error || "api_error")
}

return data

}

/* REGISTER + RESOLVE + QUOTE */

async function startFlow(){

try{

sendBtn.disabled = true
continueBtn.disabled = true
pixBox.style.display = "none"
summaryBox.style.display = "none"
taxBox.style.display = "none"

setStep(1)
setStatus("Registering...")

const amount = Number(document.getElementById("amount").value)

if(!Number.isFinite(amount) || amount <= 0){
throw new Error("Invalid amount")
}

const country = document.getElementById("country").value
const source = document.getElementById("source_country").value

const reg = await api("session/register",{
source_country:source,
receiver_country:country
})

sessionId = reg.session_id

setStatus("Resolving route...")

const resolve = await api("session/resolve",{ session_id:sessionId })

if(!resolve?.delivery_options?.execution?.pix){
throw new Error("PIX route unavailable")
}

setStatus("Getting quote...")

const quote = await api("session/quote",{
session_id:sessionId,
amount
})

if(!quote.routes?.length){
throw new Error("No routes available")
}

currentRoute = quote.routes[0]
routeId = currentRoute.route_id || currentRoute.id

updateSummaryFromQuote(currentRoute)

setStep(2)

pixBox.style.display = "block"
continueBtn.disabled = false

if(currentRoute.requires_tax_id){
taxBox.style.display = "block"
}

document.getElementById("pix").focus()

setStatus("Enter PIX key")

}
catch(err){

console.error(err)
setStatus(err.message,"error")
sendBtn.disabled = false
continueBtn.disabled = false

}

}

/* CREATE + FUNDING */

async function continueFlow(){

try{

continueBtn.disabled = true

const pix = document.getElementById("pix").value.trim()
const tax_id = document.getElementById("taxId").value.trim()

if(!pix){
throw new Error("PIX required")
}

const destination =
tax_id ? { pix,tax_id } : { pix }

setStatus("Creating settlement...")

const create = await api("settlement/create",{
session_id:sessionId,
route_id:routeId,
destination
})

settlementId = create.settlement_id

localStorage.setItem("ub_settlement",settlementId)

setStatus("Redirecting to payment...")

const funding = await api("funding/session",{ settlement_id:settlementId })

if(!funding.widget_url){
throw new Error("Ramp unavailable")
}

setStep(3)

window.location.href = funding.widget_url

}
catch(err){

console.error(err)
setStatus(err.message,"error")
continueBtn.disabled = false

}

}

/* CONFIRM PAYMENT */

async function confirmSettlement(){

if(confirming) return
confirming = true

try{

setStep(4)
setStatus("Confirming payment...")

await api("settlement/confirm",{ settlement_id:settlementId })

setStatus("Payment verified")

startPolling()

}
catch(err){

if(err.message === "funding_not_confirmed"){
setStatus("Waiting for payment confirmation...")
startPolling()
confirming = false
return
}

console.error(err)
setStatus("Confirm failed","error")
confirming = false

}

}

/* POLLING */

function startPolling(){

if(!settlementId) return
if(poller) return

poller = setInterval(async ()=>{

try{

const data = await getStatus(settlementId)

if(data.status === "pending_funding"){
setStep(4)
setStatus("Waiting for payment confirmation...")
}

if(data.status === "submitted"){
setStep(4)
setStatus("Transfer submitted")
}

if(data.status === "executing"){
setStep(4)
setStatus("Transfer executing")
}

if(data.status === "completed"){

clearInterval(poller)
poller = null

setStep(5)
setStatus("Transfer completed","success")

localStorage.removeItem("ub_settlement")
settlementId = null
confirming = false

}

if(data.status === "failed"){

clearInterval(poller)
poller = null

setStep(5)
setStatus("Transfer failed","error")

localStorage.removeItem("ub_settlement")
settlementId = null
confirming = false

}

}
catch(e){
console.error(e)
}

},5000)

}

/* RESUME AFTER REFRESH */

window.addEventListener("load",async()=>{

const saved = localStorage.getItem("ub_settlement")

if(!saved) return

try{

settlementId = saved

const data = await getStatus(settlementId)

if(
data.status === "submitted" ||
data.status === "executing" ||
data.status === "pending_funding"
){

setStep(4)
setStatus("Resuming transfer...")
startPolling()

}else{

localStorage.removeItem("ub_settlement")
settlementId = null
setStep(1)

}

}catch(e){

localStorage.removeItem("ub_settlement")
settlementId = null
setStep(1)

}

})

/* RETURN FROM PAYMENT */

window.addEventListener("focus",()=>{

if(!settlementId) return
if(poller) return
if(confirming) return

confirmSettlement()

})

sendBtn.onclick = startFlow
continueBtn.onclick = continueFlow
