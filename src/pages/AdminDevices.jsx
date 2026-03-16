// AdminDevices — redirects to AdminUsers devices tab
// (Devices are managed within the AdminUsers page under the Devices tab)
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminDevices() {
  const navigate = useNavigate();
  useEffect(() => { navigate(createPageUrl('AdminUsers'), { replace: true }); }, []);
  return null;
}