import { useState } from 'react';
import { createCompany } from '../api/company';

export default function CompanyPage() {
  const [name, setName] = useState('');
  const [npwp, setNpwp] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async () => {
    try {
      await createCompany({ name, npwp });
      setMsg('회사 생성 성공');
    } catch (e: any) {
      setMsg(e.message?.join(', ') ?? '에러');
    }
  };

  return (
    <div>
      <h2>Create Company</h2>

      <input
        placeholder="회사명"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <input
        placeholder="NPWP (15자리)"
        value={npwp}
        onChange={e => setNpwp(e.target.value)}
      />

      <button onClick={submit}>생성</button>

      <p>{msg}</p>
    </div>
  );
}