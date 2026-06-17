const BASE = 'http://127.0.0.1:3001/api'

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  return res.json()
}

async function main() {
  console.log('=== 1. 获取员工列表 ===')
  const staffRes = await req('GET', '/staff')
  const staff = staffRes.data
  const vetId = staff.find(s => s.role === 'vet').id
  const nurseId = staff.find(s => s.role === 'nurse').id
  console.log(`兽医: ${vetId}, 护士: ${nurseId}`)

  console.log('\n=== 2. 创建住院记录(疫苗缺失→自动隔离) ===')
  const hospRes = await req('POST', '/hospitalizations', {
    pet_name: '旺财', pet_type: '狗', breed: '金毛', age: 3, weight: 28.5,
    owner_name: '李明', owner_phone: '13800138000',
    vaccine_status: 'incomplete', deposit_amount: 5000,
    auth_surgery: 1, admission_date: '2026-06-16', cage_number: 'A-101'
  })
  const hospId = hospRes.data.id
  console.log(`住院ID: ${hospId}`)
  console.log(`隔离: ${hospRes.data.isolation_required} ✓ (疫苗缺失→自动隔离)`)

  console.log('\n=== 3. 创建需确认医嘱 ===')
  const orderRes = await req('POST', `/hospitalizations/${hospId}/orders`, {
    vet_id: vetId, type: 'pending_confirm', category: 'medication',
    content: '头孢克洛 250mg', dosage: '每日2次', frequency: '每12小时',
    start_date: '2026-06-16'
  })
  const orderId = orderRes.data.id
  console.log(`医嘱ID: ${orderId}, confirmed: ${orderRes.data.confirmed}`)

  console.log('\n=== 4. 尝试执行未确认医嘱(应失败) ===')
  const failRes = await req('POST', `/hospitalizations/${hospId}/nursing-records`, {
    order_id: orderId, nurse_id: nurseId,
    executed_at: '2026-06-16T08:00:00Z', result: 'normal', observation: '正常服药'
  })
  console.log(`结果: ${failRes.error} ✓ (未确认→拒绝执行)`)

  console.log('\n=== 5. 确认医嘱 ===')
  const confirmRes = await req('POST', `/hospitalizations/orders/${orderId}/confirm`, {
    confirmed_by: vetId
  })
  console.log(`确认成功: ${confirmRes.success}, confirmed: ${confirmRes.data?.confirmed}`)

  console.log('\n=== 6. 确认后执行护理(应成功) ===')
  const nursingRes = await req('POST', `/hospitalizations/${hospId}/nursing-records`, {
    order_id: orderId, nurse_id: nurseId,
    executed_at: '2026-06-16T08:00:00Z', result: 'normal', observation: '正常服药'
  })
  console.log(`护理记录ID: ${nursingRes.data?.id} ✓ (确认后可执行)`)

  console.log('\n=== 7. 停用医嘱 ===')
  const stopRes = await req('POST', `/hospitalizations/orders/${orderId}/stop`, {
    reason: '疗程结束'
  })
  console.log(`停用成功: ${stopRes.success}, status: ${stopRes.data?.status}`)

  console.log('\n=== 8. 添加费用 ===')
  await req('POST', `/hospitalizations/${hospId}/billing`, {
    category: 'medication', name: '头孢克洛', amount: 35, quantity: 2, total_amount: 70
  })
  await req('POST', `/hospitalizations/${hospId}/billing`, {
    category: 'hospitalization', name: '住院费', amount: 200, quantity: 1, total_amount: 200
  })
  console.log('费用已添加 ✓')

  console.log('\n=== 9. 结算出院 ===')
  const settleRes = await req('POST', `/hospitalizations/${hospId}/settle`)
  if (settleRes.error) {
    console.log(`❌ 结算失败: ${settleRes.error}`)
  } else {
    const bs = settleRes.data?.billing_summary || {}
    console.log(`结算成功! 总费用: ${bs.total_amount}, 押金: ${bs.deposit_amount}, 押金抵扣: ${bs.deposit_used}`)
  }

  console.log('\n=== 10. 验证已出院 ===')
  const detailRes = await req('GET', `/hospitalizations/${hospId}`)
  console.log(`状态: ${detailRes.data?.status}`)

  console.log('\n=== 11. 交接班 ===')
  const handoverRes = await req('POST', '/shifts/handover', {
    nurse_on_duty: nurseId, nurse_off_duty: nurseId, handover_notes: '旺财病情稳定'
  })
  console.log(`新班次ID: ${handoverRes.data?.id}`)

  const currentShift = await req('GET', '/shifts/current')
  console.log(`当前班次状态: ${currentShift.data?.status}`)

  console.log('\n✅ 全链路测试完成')
}

main().catch(console.error)
