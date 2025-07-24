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
      await clientService.update(selectedClient._id, payload);
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>قائمة العملاء ({filteredClients.length})</span>
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
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                    <button
                      onClick={() => {
                        if (selectedClients.length === filteredClients.length) {
                          setSelectedClients([]);
                        } else {
                          setSelectedClients(filteredClients.map((c) => c.id));
                        }
                      }}
                      className="p-1"
                    >
                      {selectedClients.length === filteredClients.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                    العميل
                  </th>
                  {/* <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                    النوع
                  </th> */}
                  <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                    الحالة
                  </th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                    الرصيد
                  </th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                    العمليات
                  </th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                    آخر عملية
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr
                    key={client._id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => {
                          if (selectedClients.includes(client._id)) {
                            setSelectedClients(
                              selectedClients.filter((id) => id !== client._id)
                            );
                          } else {
                            setSelectedClients([
                              ...selectedClients,
                              client._id,
                            ]);
                          }
                        }}
                        className="p-1"
                      >
                        {selectedClients.includes(client._id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-2">
                      <div
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors"
                        // onClick={() => navigate(`/clients/${client._id}`)}
                      >
                        <div className="font-medium text-gray-900 dark:text-white hover:text-blue-600">
                          {client.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                          <Mail className="w-3 h-3 ml-1" />
                          {client.email}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                          <Phone className="w-3 h-3 ml-1" />
                          {client.phone}
                        </div>
                      </div>
                    </td>
                    {/* <td className="py-3 px-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          client.type === "شركة"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            : client.type === "مؤسسة"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                            : client.type === "فرد"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                        }`}
                      >
                        {client.type}
                      </span>
                    </td> */}
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          client.status === "نشط"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : client.status === "معلق"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        }`}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div
                        className={`font-medium ${
                          client.currentBalance >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatCurrency(Math.abs(client.currentBalance) || 0)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {client.currentBalance >= 0 ? "له علينا" : "عليه لنا"}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {client.totalTransactions}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        عملية
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {client.lastTransaction
                          ? formatDate(client.lastTransaction)
                          : "لا توجد"}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex justify-center space-x-1 rtl:space-x-reverse">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(client)}
                          className="h-8 w-8 !p-0"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedClient(client);
                            setMessageType("single");
                            setShowMessageModal(true);
                          }}
                          className="h-8 w-8 !p-0 text-green-600 hover:text-green-700"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedClient(client);
                            setShowEditModal(true);
                          }}
                          className="h-8 w-8 !p-0"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClient(client._id)}
                          className="h-8 w-8 !p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredClients.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p>لا توجد عملاء مطابقة للبحث</p>
            </div>
          )}
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
  });

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
                  <MapPin className="w-4 h-4 ml-1" /> {client.address}
                </p>
                <p>
                  <span className="font-medium">المسؤول:</span>{" "}
                  {client.contactPerson}
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

