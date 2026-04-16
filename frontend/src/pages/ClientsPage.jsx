import {
  Calculator,
  CheckSquare,
  CreditCard,
  DollarSign,
  Download,
  Edit3,
  Eye,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { clientService } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";

const ClientsPage = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("الكل");
  const [filterType, setFilterType] = useState("الكل");
  const [sortBy, setSortBy] = useState("name");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedClients, setSelectedClients] = useState([]);
  const [messageType, setMessageType] = useState("single"); // 'single' or 'multiple'

  // جلب العملاء من الباك إند مع توحيد الحقول
  const fetchClients = async () => {
    try {
      setLoading(loading);
      const response = await clientService.getAll();
      // تحويل الحقول لتسهيل العرض في الفرونت
      const mappedClients = (response.data || []).map((client) => ({
        ...client,
        // فك address
        addressStreet: client.address?.street || "",
        addressCity: client.address?.city || "",
        addressGovernorate: client.address?.governorate || "",
        addressCountry: client.address?.country || "",
        addressPostalCode: client.address?.postalCode || "",
        // فك contactPerson
        contactPersonName: client.contactPerson?.name || "",
        contactPersonPosition: client.contactPerson?.position || "",
        contactPersonEmail: client.contactPerson?.email || "",
        contactPersonPhone: client.contactPerson?.phone || "",
        // فك financialInfo
        creditLimit: client.financialInfo?.creditLimit || 0,
        paymentTerms: client.financialInfo?.paymentTerms || "",
        taxNumber: client.financialInfo?.taxNumber || "",
        currency: client.financialInfo?.currency || "ج.م",
      }));
      setClients(mappedClients);
    } catch (error) {
      toast.error("حدث خطأ أثناء جلب العملاء");
      setClients([]);
    } finally {
      setLoading(!loading);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // إحصائيات العملاء
  const clientStats = {
    total: clients.length,
    active: clients.filter((c) => c.status === "نشط" || c.status === "active")
      .length,
    suspended: clients.filter(
      (c) => c.status === "معلق" || c.status === "suspended"
    ).length,
    totalBalance: clients.reduce((sum, c) => sum + (c.currentBalance || 0), 0),
    totalCredit: clients.reduce((sum, c) => sum + (c.creditLimit || 0), 0),
    totalTransactions: clients.reduce(
      (sum, c) => sum + (c.totalTransactions || 0),
      0
    ),
  };

  // تصفية العملاء
  const filteredClients = clients
    .filter((client) => {
      const matchesSearch =
        (client.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.phone || "").includes(searchTerm);
      const matchesStatus =
        filterStatus === "الكل" ||
        client.status === filterStatus ||
        client.status ===
          (filterStatus === "نشط"
            ? "active"
            : filterStatus === "معلق"
            ? "suspended"
            : filterStatus);
      const matchesType = filterType === "الكل" || client.type === filterType;
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "balance")
        return (b.currentBalance || 0) - (a.currentBalance || 0);
      if (sortBy === "joinDate")
        return new Date(b.joinDate) - new Date(a.joinDate);
      if (sortBy === "lastTransaction")
        return new Date(b.lastTransaction) - new Date(a.lastTransaction);
      return 0;
    });

  // عمليات CRUD مربوطة بالباك إند
  const handleAddClient = async (clientData) => {
    try {
      const payload = {
        name: clientData.name,
        company: clientData.company,
        email: clientData.email,
        phone: clientData.phone,
        industry: clientData.industry,
        status: clientData.status,
        notes: clientData.notes,
        logoUrl: clientData.logoUrl || null,
        address: {
          street: clientData.addressStreet,
          city: clientData.addressCity,
          governorate: clientData.addressGovernorate,
          country: clientData.addressCountry,
          postalCode: clientData.addressPostalCode,
        },
        contactPerson: {
          name: clientData.contactPersonName,
          position: clientData.contactPersonPosition,
          email: clientData.contactPersonEmail,
          phone: clientData.contactPersonPhone,
        },
        financialInfo: {
          creditLimit: clientData.creditLimit,
          paymentTerms: clientData.paymentTerms,
          taxNumber: clientData.taxNumber,
          currency: clientData.currency || "ج.م",
        },
      };
      await clientService.create(payload);
      toast.success("تم إضافة العميل بنجاح");
      fetchClients();
      setShowAddModal(false);
    } catch (error) {
      toast.error("حدث خطأ أثناء إضافة العميل");
    }
  };

  const handleEditClient = async (clientData) => {
    try {
      const payload = {
        name: clientData.name,
        company: clientData.company,
        email: clientData.email,
        phone: clientData.phone,
        industry: clientData.industry,
        status: clientData.status,
        notes: clientData.notes,
        logoUrl: clientData.logoUrl || null,
        address: {
          street: clientData.addressStreet,
          city: clientData.addressCity,
          governorate: clientData.addressGovernorate,
          country: clientData.addressCountry,
          postalCode: clientData.addressPostalCode,
        },
        contactPerson: {
          name: clientData.contactPersonName,
          position: clientData.contactPersonPosition,
          email: clientData.contactPersonEmail,
          phone: clientData.contactPersonPhone,
        },
        financialInfo: {
          creditLimit: clientData.creditLimit,
          paymentTerms: clientData.paymentTerms,
          taxNumber: clientData.taxNumber,
          currency: clientData.currency || "ج.م",
        },
      };
      await clientService.update(selectedClient._id || selectedClient.id, payload);
      toast.success("تم تحديث بيانات العميل بنجاح");
      fetchClients();
      setShowEditModal(false);
      setSelectedClient(null);
    } catch (error) {
      toast.error("حدث خطأ أثناء تحديث بيانات العميل");
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (
      window.confirm(
        "هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع العمليات المرتبطة به."
      )
    ) {
      try {
        await clientService.delete(clientId);
        toast.success("تم حذف العميل بنجاح");
        fetchClients();
      } catch (error) {
        toast.error("حدث خطأ أثناء حذف العميل");
      }
    }
  };

  const handleViewDetails = (client) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  };

  return (
    <div className="space-y-6">
      {/* العنوان والإحصائيات */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Users className="w-8 h-8 text-blue-500 ml-3" />
            إدارة العملاء
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            متابعة وإدارة العملاء والحسابات المالية
          </p>
        </div>
        <div className="flex space-x-3 rtl:space-x-reverse">
          {selectedClients.length > 0 && (
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setMessageType("multiple");
                setShowMessageModal(true);
              }}
            >
              <MessageSquare className="w-4 h-4 ml-2" />
              إرسال رسالة ({selectedClients.length})
            </Button>
          )}
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة عميل جديد
          </Button>
        </div>
      </div>

      {/* الإحصائيات السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                  إجمالي العملاء
                </p>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                  {clientStats.total}
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-400">
                  نشط: {clientStats.active} | معلق: {clientStats.suspended}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 dark:text-green-400 text-sm font-medium">
                  الرصيد الإجمالي
                </p>
                <p
                  className={`text-2xl font-bold ${
                    clientStats.totalBalance >= 0
                      ? "text-green-800 dark:text-green-200"
                      : "text-red-800 dark:text-red-200"
                  }`}
                >
                  {formatCurrency(Math.abs(clientStats.totalBalance))}
                </p>
                <p className="text-xs text-green-500 dark:text-green-400">
                  {clientStats.totalBalance >= 0 ? "لهم علينا" : "عليهم لنا"}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">
                  حد الائتمان
                </p>
                <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                  {formatCurrency(clientStats.totalCredit)}
                </p>
                <p className="text-xs text-purple-500 dark:text-purple-400">
                  إجمالي الحدود المتاحة
                </p>
              </div>
              <CreditCard className="w-8 h-8 text-purple-500 dark:text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 dark:text-orange-400 text-sm font-medium">
                  العمليات
                </p>
                <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                  {clientStats.totalTransactions}
                </p>
                <p className="text-xs text-orange-500 dark:text-orange-400">
                  إجمالي العمليات المسجلة
                </p>
              </div>
              <Calculator className="w-8 h-8 text-orange-500 dark:text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* أدوات البحث والتصفية */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="البحث في العملاء..."
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <select
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="الكل">جميع الحالات</option>
              <option value="نشط">نشط</option>
              <option value="معلق">معلق</option>
              <option value="موقوف">موقوف</option>
            </select>

            <select
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="الكل">جميع الأنواع</option>
              <option value="شركة">شركة</option>
              <option value="مؤسسة">مؤسسة</option>
              <option value="فرد">فرد</option>
              <option value="مكتب">مكتب</option>
            </select>

            <select
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">ترتيب بالاسم</option>
              <option value="balance">ترتيب بالرصيد</option>
              <option value="joinDate">ترتيب بتاريخ الانضمام</option>
              <option value="lastTransaction">ترتيب بآخر عملية</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* قائمة العملاء */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-l from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              قائمة العملاء ({filteredClients.length})
            </span>
            <div className="flex space-x-2 rtl:space-x-reverse">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 ml-2" />
                تصدير
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 ml-2" />
                استيراد
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-l from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-850">
                  {['', 'العميل', 'الحالة', 'الرصيد', 'المشاريع', 'آخر عملية', ''].map((h, i) => (
                    <th key={i} className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${i <= 1 ? 'text-right' : 'text-center'} whitespace-nowrap`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-gray-400 dark:text-gray-500">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">لا توجد عملاء مطابقة للبحث</p>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client, index) => (
                    <tr
                      key={client._id || client.id}
                      className={`group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200 cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}
                      onClick={() => handleViewDetails(client)}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-5 w-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedClients.includes(client._id || client.id)) {
                              setSelectedClients(selectedClients.filter((id) => id !== (client._id || client.id)));
                            } else {
                              setSelectedClients([...selectedClients, client._id || client.id]);
                            }
                          }}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          {selectedClients.includes(client._id || client.id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      {/* Client Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                            {client.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{client.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {client.email || '-'}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3" /> {client.phone}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="py-4 px-5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          client.status === 'active' || client.status === 'نشط'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : client.status === 'potential'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : client.status === 'معلق' || client.status === 'inactive'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ml-1.5 ${
                            client.status === 'active' || client.status === 'نشط' ? 'bg-green-500' : client.status === 'potential' ? 'bg-blue-500' : 'bg-yellow-500'
                          }`} />
                          {client.status === 'active' ? 'نشط' : client.status === 'potential' ? 'محتمل' : client.status}
                        </span>
                      </td>
                      {/* Balance */}
                      <td className="py-4 px-5 text-center">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                          (client.currentBalance || 0) > 0
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : (client.currentBalance || 0) < 0
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          <DollarSign className="w-3 h-3" />
                          {new Intl.NumberFormat('en-US').format(Math.abs(client.currentBalance || 0))} EGP
                        </div>
                      </td>
                      {/* Projects */}
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-semibold font-mono">
                            {client.totalProjects || 0}
                          </span>
                          {(client.activeProjects || 0) > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                              {client.activeProjects} نشط
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Last Activity */}
                      <td className="py-4 px-5 text-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {client.lastPaymentDate ? new Date(client.lastPaymentDate).toLocaleDateString('en-GB') : '—'}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewDetails(client); }}
                            className="p-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            title="عرض التفاصيل"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setShowEditModal(true); }}
                            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="تعديل"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setMessageType("single"); setShowMessageModal(true); }}
                            className="p-2 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            title="رسالة"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteClient(client._id || client.id); }}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* النماذج */}
      {showAddModal && (
        <ClientModal
          title="إضافة عميل جديد"
          onSave={handleAddClient}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showEditModal && selectedClient && (
        <ClientModal
          title="تعديل بيانات العميل"
          client={selectedClient}
          onSave={handleEditClient}
          onClose={() => {
            setShowEditModal(false);
            setSelectedClient(null);
          }}
        />
      )}

      {showDetailsModal && selectedClient && (
        <ClientDetailsModal
          client={selectedClient}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedClient(null);
          }}
        />
      )}

      {showMessageModal && (
        <MessageModal
          type={messageType}
          client={selectedClient}
          clients={selectedClients}
          allClients={clients}
          onClose={() => {
            setShowMessageModal(false);
            setSelectedClient(null);
            setSelectedClients([]);
          }}
        />
      )}
    </div>
  );
};

// مكون نموذج إضافة/تعديل العميل
const ClientModal = ({ title, client, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: client?.name || "",
    company: client?.company || "",
    email: client?.email || "",
    phone: client?.phone || "",
    industry: client?.industry || "",
    status: client?.status || "نشط",
    notes: client?.notes || "",
    // عنوان مفصل
    addressStreet: client?.addressStreet || "",
    addressCity: client?.addressCity || "",
    addressGovernorate: client?.addressGovernorate || "",
    addressCountry: client?.addressCountry || "مصر",
    addressPostalCode: client?.addressPostalCode || "",
    // شخص الاتصال
    contactPersonName: client?.contactPersonName || "",
    contactPersonPosition: client?.contactPersonPosition || "",
    contactPersonEmail: client?.contactPersonEmail || "",
    contactPersonPhone: client?.contactPersonPhone || "",
    // معلومات مالية
    creditLimit: client?.creditLimit || 0,
    paymentTerms: client?.paymentTerms || "30",
    taxNumber: client?.taxNumber || "",
    currency: client?.currency || "ج.م",
    logoUrl: client?.logoUrl || "",
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('field', 'client_logo');
    try {
      const token = localStorage.getItem('token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      const res = await fetch(backendUrl + '/api/company-settings/upload', {
        method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({ ...prev, logoUrl: backendUrl + data.data.url }));
      }
    } catch (err) { console.error('Upload error:', err); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <Button variant="outline" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* لوجو العميل */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">لوجو العميل / الشركة</label>
            <div className="flex items-center gap-4">
              {formData.logoUrl ? (
                <img src={formData.logoUrl} alt="logo" className="w-16 h-16 object-contain rounded-lg border border-gray-200 dark:border-gray-600 bg-white p-1" onError={(e) => { e.target.style.display = 'none' }} />
              ) : (
                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 text-xs">لا يوجد</div>
              )}
              <div className="flex-1 flex gap-2">
                <input type="url" placeholder="رابط اللوجو أو ارفع من جهازك" value={formData.logoUrl} onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })} dir="ltr" className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <label className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg cursor-pointer hover:bg-blue-700 transition-colors whitespace-nowrap flex items-center gap-1">
                  رفع ملف
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              </div>
            </div>
          </div>

          {/* المعلومات الأساسية */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
              المعلومات الأساسية
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم العميل *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="اسم العميل أو الشخص المسؤول"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم الشركة
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                  placeholder="اسم الشركة أو المؤسسة"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="example@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  رقم الهاتف *
                </label>
                <input
                  type="tel"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="01234567890 أو 201234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المجال
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.industry}
                  onChange={(e) =>
                    setFormData({ ...formData, industry: e.target.value })
                  }
                >
                  <option value="">اختر المجال</option>
                  <option value="تكنولوجيا المعلومات">
                    تكنولوجيا المعلومات
                  </option>
                  <option value="التجارة">التجارة</option>
                  <option value="الصناعة">الصناعة</option>
                  <option value="الخدمات">الخدمات</option>
                  <option value="المقاولات">المقاولات</option>
                  <option value="الاستشارات">الاستشارات</option>
                  <option value="التعليم">التعليم</option>
                  <option value="الصحة">الصحة</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الحالة
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                >
                  <option value="نشط">نشط</option>
                  <option value="معلق">معلق</option>
                  <option value="موقوف">موقوف</option>
                </select>
              </div>
            </div>
          </div>

          {/* العنوان */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
              العنوان
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الشارع
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.addressStreet}
                  onChange={(e) =>
                    setFormData({ ...formData, addressStreet: e.target.value })
                  }
                  placeholder="رقم المبنى، اسم الشارع"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المدينة
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.addressCity}
                  onChange={(e) =>
                    setFormData({ ...formData, addressCity: e.target.value })
                  }
                  placeholder="اسم المدينة"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المحافظة
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.addressGovernorate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      addressGovernorate: e.target.value,
                    })
                  }
                >
                  <option value="">اختر المحافظة</option>
                  <option value="القاهرة">القاهرة</option>
                  <option value="الجيزة">الجيزة</option>
                  <option value="الإسكندرية">الإسكندرية</option>
                  <option value="الدقهلية">الدقهلية</option>
                  <option value="الشرقية">الشرقية</option>
                  <option value="القليوبية">القليوبية</option>
                  <option value="كفر الشيخ">كفر الشيخ</option>
                  <option value="الغربية">الغربية</option>
                  <option value="المنوفية">المنوفية</option>
                  <option value="البحيرة">البحيرة</option>
                  <option value="الإسماعيلية">الإسماعيلية</option>
                  <option value="بورسعيد">بورسعيد</option>
                  <option value="السويس">السويس</option>
                  <option value="شمال سيناء">شمال سيناء</option>
                  <option value="جنوب سيناء">جنوب سيناء</option>
                  <option value="المنيا">المنيا</option>
                  <option value="بني سويف">بني سويف</option>
                  <option value="الفيوم">الفيوم</option>
                  <option value="أسيوط">أسيوط</option>
                  <option value="سوهاج">سوهاج</option>
                  <option value="قنا">قنا</option>
                  <option value="الأقصر">الأقصر</option>
                  <option value="أسوان">أسوان</option>
                  <option value="البحر الأحمر">البحر الأحمر</option>
                  <option value="الوادي الجديد">الوادي الجديد</option>
                  <option value="مطروح">مطروح</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الرمز البريدي
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.addressPostalCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      addressPostalCode: e.target.value,
                    })
                  }
                  placeholder="12345"
                />
              </div>
            </div>
          </div>

          {/* شخص الاتصال */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
              شخص الاتصال
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم الشخص المسؤول
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.contactPersonName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contactPersonName: e.target.value,
                    })
                  }
                  placeholder="اسم الشخص المسؤول"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المنصب
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.contactPersonPosition}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contactPersonPosition: e.target.value,
                    })
                  }
                  placeholder="مدير، مسؤول المشتريات، إلخ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  بريد إلكتروني للشخص المسؤول
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.contactPersonEmail}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contactPersonEmail: e.target.value,
                    })
                  }
                  placeholder="contact@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  هاتف الشخص المسؤول
                </label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.contactPersonPhone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contactPersonPhone: e.target.value,
                    })
                  }
                  placeholder="01234567890"
                />
              </div>
            </div>
          </div>

          {/* المعلومات المالية */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
              المعلومات المالية
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  حد الائتمان (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.creditLimit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      creditLimit: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  مدة السداد (أيام)
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.paymentTerms}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentTerms: e.target.value })
                  }
                >
                  <option value="0">نقدي</option>
                  <option value="15">15 يوم</option>
                  <option value="30">30 يوم</option>
                  <option value="45">45 يوم</option>
                  <option value="60">60 يوم</option>
                  <option value="90">90 يوم</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الرقم الضريبي
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.taxNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, taxNumber: e.target.value })
                  }
                  placeholder="123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  العملة
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value })
                  }
                >
                  <option value="ج.م">جنيه مصري (ج.م)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="EUR">يورو (EUR)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ملاحظات
            </label>
            <textarea
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="أي ملاحظات إضافية عن العميل..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              className="bg-primary text-white hover:bg-primary/90"
            >
              {title.includes("إضافة") ? "إضافة العميل" : "حفظ التغييرات"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// مكون عرض تفاصيل العميل
const ClientDetailsModal = ({ client, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            تفاصيل العميل: {client.name}
          </h3>
          <Button variant="outline" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* معلومات العميل الأساسية */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                معلومات أساسية
              </h4>
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-medium">النوع:</span> {client.type}
                </p>
                <p>
                  <span className="font-medium">الحالة:</span> {client.status}
                </p>
                <p>
                  <span className="font-medium">الفئة:</span> {client.category}
                </p>
                <p>
                  <span className="font-medium">الرقم الضريبي:</span>{" "}
                  {client.taxNumber}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                معلومات التواصل
              </h4>
              <div className="text-sm space-y-1">
                <p className="flex items-center">
                  <Mail className="w-4 h-4 ml-1" /> {client.email}
                </p>
                <p className="flex items-center">
                  <Phone className="w-4 h-4 ml-1" /> {client.phone}
                </p>
                <p className="flex items-center">
                  <MapPin className="w-4 h-4 ml-1" /> {typeof client.address === 'object' ? [client.address?.street, client.address?.city, client.address?.governorate].filter(Boolean).join(' - ') : (client.address || 'غير محدد')}
                </p>
                <p>
                  <span className="font-medium">المسؤول:</span>{" "}
                  {typeof client.contactPerson === 'object' ? (client.contactPerson?.name || 'غير محدد') : (client.contactPerson || 'غير محدد')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                معلومات مالية
              </h4>
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-medium">الرصيد الحالي:</span>
                  <span
                    className={
                      client.currentBalance >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {formatCurrency(Math.abs(client.currentBalance))}
                  </span>
                </p>
                <p>
                  <span className="font-medium">حد الائتمان:</span>{" "}
                  {formatCurrency(client.creditLimit)}
                </p>
                <p>
                  <span className="font-medium">شروط السداد:</span>{" "}
                  {client.paymentTerms}
                </p>
                <p>
                  <span className="font-medium">العمليات:</span>{" "}
                  {client.totalTransactions}
                </p>
              </div>
            </div>
          </div>

          {/* تواريخ مهمة */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              تواريخ مهمة
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <p>
                <span className="font-medium">تاريخ الانضمام:</span>{" "}
                {formatDate(client.joinDate)}
              </p>
              <p>
                <span className="font-medium">آخر عملية:</span>{" "}
                {client.lastTransaction
                  ? formatDate(client.lastTransaction)
                  : "لا توجد"}
              </p>
            </div>
          </div>

          {/* ملاحظات */}
          {client.notes && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                ملاحظات
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                {client.notes}
              </p>
            </div>
          )}

          {/* أزرار الإجراءات */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex space-x-3 rtl:space-x-reverse">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => (window.location.href = `/clients/${client._id}`)}
            >
              <FileText className="w-4 h-4 ml-2" />
              عرض العمليات
            </Button>
            <Button variant="outline">
              <Plus className="w-4 h-4 ml-2" />
              إضافة عملية
            </Button>
            <Button variant="outline">
              <Edit3 className="w-4 h-4 ml-2" />
              تعديل البيانات
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// مكون إرسال الرسائل
const MessageModal = ({ type, client, clients, allClients, onClose }) => {
  const [messageData, setMessageData] = useState({
    message: "",
    template: "custom",
    attachments: [],
  });
  const [sending, setSending] = useState(false);

  const messageTemplates = [
    { id: "custom", name: "رسالة مخصصة", content: "" },
    {
      id: "greeting",
      name: "رسالة ترحيب",
      content: "مرحباً بك في نظامنا، نتطلع للعمل معك.",
    },
    {
      id: "reminder",
      name: "تذكير دفع",
      content: "نذكركم بوجود مستحقات عليكم، يرجى المراجعة.",
    },
    {
      id: "thanks",
      name: "رسالة شكر",
      content: "نشكركم على تعاملكم معنا ونتطلع لاستمرار الشراكة.",
    },
    {
      id: "meeting",
      name: "دعوة اجتماع",
      content: "ندعوكم لحضور اجتماع مهم، سيتم تحديد الموعد لاحقاً.",
    },
  ];

  const getTargetClients = () => {
    if (type === "single" && client) {
      return [client];
    } else if (type === "multiple" && clients && clients.length > 0) {
      return allClients.filter((c) => clients.includes(c.id));
    }
    return [];
  };

  const handleTemplateChange = (templateId) => {
    const template = messageTemplates.find((t) => t.id === templateId);
    setMessageData({
      ...messageData,
      template: templateId,
      message: template ? template.content : "",
    });
  };

  const handleSendMessage = async () => {
    const targetClients = getTargetClients();

    if (!messageData.message.trim()) {
      alert("يرجى كتابة الرسالة");
      return;
    }

    if (targetClients.length === 0) {
      alert("لا توجد عملاء محددين لإرسال الرسالة");
      return;
    }

    setSending(true);

    try {
      // هنا سيتم تكامل WhatsApp API
      for (const targetClient of targetClients) {
        console.log("إرسال رسالة إلى:", targetClient.name, targetClient.phone);
        console.log("محتوى الرسالة:", messageData.message);

        // محاكاة API call
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      alert(`تم إرسال الرسالة بنجاح إلى ${targetClients.length} عميل`);
      onClose();
    } catch (error) {
      console.error("خطأ في إرسال الرسالة:", error);
      alert("حدث خطأ في إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  const targetClients = getTargetClients();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {type === "single"
              ? "إرسال رسالة لعميل"
              : `إرسال رسالة لـ ${targetClients.length} عميل`}
          </h3>
          <Button variant="outline" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        <div className="p-6 space-y-4">
          {/* معلومات العملاء المستهدفين */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
              العملاء المستهدفين:
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {targetClients.map((client) => (
                <div
                  key={client._id}
                  className="flex items-center justify-between bg-white dark:bg-gray-600 rounded p-2"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {client.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      <Phone className="w-3 h-3 ml-1" />
                      {client.phone}
                    </div>
                  </div>
                  <MessageSquare className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </div>
          </div>

          {/* قوالب الرسائل */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              قالب الرسالة
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={messageData.template}
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              {messageTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* محتوى الرسالة */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              محتوى الرسالة
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows="6"
              placeholder="اكتب رسالتك هنا..."
              value={messageData.message}
              onChange={(e) =>
                setMessageData({ ...messageData, message: e.target.value })
              }
            />
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex justify-end space-x-3 rtl:space-x-reverse pt-4">
            <Button variant="outline" onClick={onClose} disabled={sending}>
              إلغاء
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleSendMessage}
              disabled={sending || !messageData.message.trim()}
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 ml-2" />
                  إرسال الرسالة
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientsPage;

