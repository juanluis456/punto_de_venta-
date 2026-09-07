import { useState, useRef, useEffect } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import patoImg from './assets/pato.jpg';

function App() {
  // 🔗 URL DIRECTA DEL BACKEND (Sin variables de entorno)
  const API_BASE = 'https://ventaspro-backend.onrender.com/api';
  
  // ☁️ 🔐 ID Y NOMBRE DE TIENDA DINÁMICOS
  const [idTienda, setIdTienda] = useState(() => localStorage.getItem('id_tienda') || '');
  const [nombreTienda, setNombreTienda] = useState(() => localStorage.getItem('nombre_tienda') || 'MI TIENDA');
  
  // 🔥 NUEVO ESTADO: Guarda los módulos VIP que compró esta tienda
  const [modulosActivos, setModulosActivos] = useState(() => {
    const guardados = localStorage.getItem('modulos_tienda');
    return guardados ? JSON.parse(guardados) : [];
  });
  
  // Estados para el formulario de Login
  const [usuarioInput, setUsuarioInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const loginInputRef = useRef(null); 

  const [carrito, setCarrito] = useState([])
  const [codigo, setCodigo] = useState('') 
  const inputRef = useRef(null)
  const [pantalla, setPantalla] = useState('ventas')
  
  // 🔥 NUEVO ESTADO PARA CONTROLAR LA CAJITA DESPLEGABLE DE STOCK BAJO
  const [mostrarListaStock, setMostrarListaStock] = useState(false);
  
  const [modalCobro, setModalCobro] = useState(false)
  const [pagoCliente, setPagoCliente] = useState('')
  const [procesandoCobro, setProcesandoCobro] = useState(false);
  
  // 🔥 SE CAMBIÓ LA CATEGORÍA POR DEFECTO A "Abarrotes"
  const [nuevoProd, setNuevoProd] = useState({ codigo: '', nombre: '', precio: '', precio_compra: '', stock: '', tipo_unidad: 'pza', contenido: '', categoria: 'Abarrotes', imagen: '' })
  
  const [busquedaSurtir, setBusquedaSurtir] = useState('')
  const [listaSurtido, setListaSurtido] = useState([])
  
  const [busquedaApagon, setBusquedaApagon] = useState('')
  const [listaApagon, setListaApagon] = useState([])

  const [listaInventario, setListaInventario] = useState([])
  const [busquedaAlmacen, setBusquedaAlmacen] = useState('')
  // 🔥 ESTADO PARA LOS BLOQUES (TABS) DEL ALMACÉN
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')
  const [productoEditando, setProductoEditando] = useState(null)

  const [datosCorte, setDatosCorte] = useState(null)
  const [historialVentas, setHistorialVentas] = useState([])

  const [modalDevolucion, setModalDevolucion] = useState(false);
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [cantidadesDevolucion, setCantidadesDevolucion] = useState([]);

  const [modalLogout, setModalLogout] = useState(false);

  // 🔒 LLAVE MAESTRA DIRECTA (Sin variables de entorno)
  const LLAVE_MAESTRA = "vazcam678";
  const [authModal, setAuthModal] = useState({ visible: false, accion: null, parametro: null, titulo: '' });
  const [passInput, setPassInput] = useState('');

  const [notificacion, setNotificacion] = useState({ visible: false, mensaje: '', tipo: 'exito' });
  const notificacionTimer = useRef(null);

  const mostrarNotificacion = (mensaje, tipo = 'exito') => {
    setNotificacion({ visible: true, mensaje, tipo });
    if (notificacionTimer.current) clearTimeout(notificacionTimer.current);
    notificacionTimer.current = setTimeout(() => {
      setNotificacion({ visible: false, mensaje: '', tipo: 'exito' });
    }, 4000);
  };

  // 🔐 MANEJAR INICIO DE SESIÓN DIRECTO DESDE MONGODB
  const manejarLogin = async (e) => {
    e.preventDefault();
    const user = usuarioInput.trim().toLowerCase();
    const pass = passwordInput.trim();

    try {
      const respuesta = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: user, password: pass })
      });

      const data = await respuesta.json();

      if (data.exito) {
        localStorage.setItem('id_tienda', data.id_tienda);
        localStorage.setItem('nombre_tienda', data.nombre);
        localStorage.setItem('modulos_tienda', JSON.stringify(data.modulos || []));
        
        setIdTienda(data.id_tienda);
        setNombreTienda(data.nombre);
        setModulosActivos(data.modulos || []);
        
        mostrarNotificacion(`🔓 ¡Bienvenido, ${data.nombre}!`);
        setUsuarioInput(''); setPasswordInput('');
      } else {
        mostrarNotificacion("❌ " + data.mensaje, "error");
      }
    } catch (error) {
      mostrarNotificacion("❌ Error al conectar con el servidor. ¿Está encendido Python?", "error");
    }
  };

  // 🚪 CERRAR SESIÓN
  const confirmarCerrarSesion = () => {
    localStorage.removeItem('id_tienda');
    localStorage.removeItem('nombre_tienda');
    localStorage.removeItem('modulos_tienda');
    setIdTienda('');
    setNombreTienda('MI TIENDA');
    setModulosActivos([]);
    setCarrito([]);
    setPantalla('ventas');
    setModalLogout(false);
    mostrarNotificacion("🔒 Sesión cerrada correctamente.");
  };

  const verificarLlaveYEjecutar = () => {
    if (passInput === LLAVE_MAESTRA) {
      if (authModal.accion === 'editarProducto') {
        setProductoEditando(authModal.parametro);
      } else if (authModal.accion === 'borrarProducto') {
        borrarProducto(authModal.parametro);
      } else if (authModal.accion === 'abrirDevolucion') {
        setTicketSeleccionado(authModal.parametro);
        setCantidadesDevolucion(new Array(authModal.parametro.articulos.length).fill(0));
        setModalDevolucion(true);
      } else if (authModal.accion === 'vaciarHistorial') {
        vaciarHistorialCompleto();
      }
      setAuthModal({ visible: false, accion: null, parametro: null, titulo: '' });
      setPassInput('');
    } else {
      mostrarNotificacion("❌ Llave de acceso INCORRECTA.", "error");
      setPassInput('');
    }
  }

  const cargarInventario = async () => {
    if (!idTienda) return;
    try {
      const respuesta = await fetch(`${API_BASE}/productos`, { headers: { 'Tienda-ID': idTienda } });
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setListaInventario(Array.isArray(datos) ? datos : []);
      }
    } catch (error) { console.error("Error al cargar inventario", error); }
  }

  const cargarCorteDeCaja = async () => {
    if (!idTienda) return;
    try {
      const respuesta = await fetch(`${API_BASE}/corte`, { headers: { 'Tienda-ID': idTienda } });
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setDatosCorte(datos);
      }
    } catch (error) { console.error("Error al cargar el corte de caja."); }
  }

  const cargarHistorialVentas = async () => {
    if (!idTienda) return;
    try {
      const respuesta = await fetch(`${API_BASE}/ventas`, { headers: { 'Tienda-ID': idTienda } });
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setHistorialVentas(Array.isArray(datos) ? datos : []);
      }
    } catch (error) { console.error("Error al cargar el historial de ventas", error); }
  }

  useEffect(() => {
    if (idTienda) cargarInventario();
  }, [idTienda]);

  useEffect(() => {
    if (!idTienda) {
      setTimeout(() => {
        if (loginInputRef.current) {
          loginInputRef.current.focus();
        }
      }, 100);
    }
  }, [idTienda]);

  useEffect(() => {
    if (!idTienda) return;
    cargarInventario();
    setBusquedaAlmacen(''); 
    setFiltroCategoria('Todos');
    setProductoEditando(null);
    setPagoCliente('');
    
    if (pantalla === 'corte') cargarCorteDeCaja();
    if (pantalla === 'tickets') cargarHistorialVentas();

    if (pantalla === 'ventas') {
      setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 150);
    }
  }, [pantalla, idTienda]);

  const formatearDinero = (monto) => Number(monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatoContenido = (item) => {
    if (item?.contenido && item?.tipo_unidad && item?.tipo_unidad !== 'pza') return `${item.contenido} ${item.tipo_unidad}`;
    else if (item?.tipo_unidad === 'pza') return 'Pieza';
    return '-';
  }
  const obtenerNombreConMedida = (item) => {
    if (!item) return 'Sin nombre';
    if (!item.tipo_unidad || item.tipo_unidad === 'pza' || !item.contenido) return String(item.nombre || 'Sin nombre');
    return `${item.nombre} (${item.contenido} ${item.tipo_unidad})`;
  }
  
  const float = (val) => parseFloat(val) || 0;

  const calcularGananciaVenta = (venta) => {
    let ganancia = 0;
    if (venta && venta.articulos) {
      venta.articulos.forEach(art => {
        ganancia += (float(art?.precio) - float(art?.precio_compra)) * float(art?.cantidad);
      });
    }
    return ganancia; 
  }

  const sugerenciasVentas = codigo.trim() ? (listaInventario || []).filter(item => {
    if (!item) return false;
    const nom = String(item.nombre || '').toLowerCase(); const cod = String(item.codigo || '').toLowerCase(); const busq = String(codigo).trim().toLowerCase();
    return nom.includes(busq) || cod.includes(busq);
  }) : [];

  const productoExactoSurtir = busquedaSurtir.trim() ? (listaInventario || []).find(item => String(item?.codigo || '') === String(busquedaSurtir).trim()) : null;
  const sugerenciasSurtir = busquedaSurtir.trim() && !productoExactoSurtir ? (listaInventario || []).filter(item => {
    if (!item) return false;
    const nom = String(item.nombre || '').toLowerCase(); const cod = String(item.codigo || '').toLowerCase(); const busq = String(busquedaSurtir).trim().toLowerCase();
    return nom.includes(busq) || cod.includes(busq);
  }) : [];

  const productoExactoApagon = busquedaApagon.trim() ? (listaInventario || []).find(item => String(item?.codigo || '') === String(busquedaApagon).trim()) : null;
  const sugerenciasApagon = busquedaApagon.trim() && !productoExactoApagon ? (listaInventario || []).filter(item => {
    if (!item) return false;
    const nom = String(item.nombre || '').toLowerCase(); const cod = String(item.codigo || '').toLowerCase(); const busq = String(busquedaApagon).trim().toLowerCase();
    return nom.includes(busq) || cod.includes(busq);
  }) : [];

  const productosPorAcabar = (listaInventario || []).filter(p => p && (p.stock !== undefined ? float(p.stock) : 0) <= 3);
  const cantidadStockBajo = productosPorAcabar.length;

  const agregarAlCarritoDirecto = (producto) => {
    if (!producto) return;
    const indexExistente = carrito.findIndex(item => String(item.codigo) === String(producto.codigo));
    const stockReal = producto.stock !== undefined ? float(producto.stock) : 0;
    
    if (indexExistente >= 0) {
      if (float(carrito[indexExistente].cantidad) + 1 > stockReal) {
        mostrarNotificacion(`⚠️ ¡Producto insuficiente! Solo tienes ${stockReal} disponibles.`, "error");
        return;
      }
      const productoActualizado = { ...carrito[indexExistente], cantidad: float(carrito[indexExistente].cantidad) + 1 };
      const carritoFiltrado = carrito.filter((_, idx) => idx !== indexExistente);
      setCarrito([productoActualizado, ...carritoFiltrado]);
    } else {
      if (stockReal < 1 && producto.tipo_unidad === 'pza') {
        mostrarNotificacion(`⚠️ ¡Producto agotado!`, "error");
        return;
      }
      setCarrito([{ ...producto, cantidad: 1 }, ...carrito]);
    }
    setCodigo(''); 
    setTimeout(() => { if(inputRef.current) inputRef.current.focus(); }, 50); 
  }

  const manejarEscaneo = (e) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    const productoExacto = (listaInventario || []).find(item => String(item?.codigo || '') === String(codigo).trim());
    if (productoExacto) agregarAlCarritoDirecto(productoExacto);
    else if (sugerenciasVentas.length > 0) agregarAlCarritoDirecto(sugerenciasVentas[0]);
    else { mostrarNotificacion("❌ Producto no encontrado.", "error"); setCodigo(''); }
  }

  const agregarAListaSurtidoDirecto = (producto) => {
    if (!producto) return;
    const indexExistente = listaSurtido.findIndex(item => String(item.codigo) === String(producto.codigo));
    if (indexExistente >= 0) {
      const productoActualizado = { ...listaSurtido[indexExistente], cantidad: float(listaSurtido[indexExistente].cantidad) + 1 };
      const listaFiltrada = listaSurtido.filter((_, idx) => idx !== indexExistente);
      setListaSurtido([productoActualizado, ...listaFiltrada]);
    } else {
      setListaSurtido([{ ...producto, cantidad: 1 }, ...listaSurtido]);
    }
    setBusquedaSurtir('');
  }

  const manejarEscaneoSurtir = (e) => {
    e.preventDefault();
    if (!busquedaSurtir.trim()) return;
    if (productoExactoSurtir) agregarAListaSurtidoDirecto(productoExactoSurtir);
    else if (sugerenciasSurtir.length > 0) agregarAListaSurtidoDirecto(sugerenciasSurtir[0]);
    else { mostrarNotificacion("❌ Producto no registrado.", "error"); setBusquedaSurtir(''); }
  }

  const modificarCantidadSurtido = (index, nuevaCantidad) => {
    const nuevaLista = [...listaSurtido];
    if (nuevaCantidad === '') { nuevaLista[index].cantidad = ''; setListaSurtido(nuevaLista); return; }
    const candy = parseFloat(nuevaCantidad);
    if (isNaN(candy) && nuevaCantidad !== '.') return;
    if (candy < 0) return;
    nuevaLista[index].cantidad = nuevaCantidad;
    setListaSurtido(nuevaLista);
  }

  const quitarDeListaSurtido = (indexAQuitar) => setListaSurtido(listaSurtido.filter((_, idx) => idx !== indexAQuitar));

  const aplicarCargamentoMasivo = async () => {
    const productosValidos = listaSurtido.map(item => ({ ...item, cantidad: item.cantidad === '' ? 1 : float(item.cantidad) }));
    if (productosValidos.length === 0) { mostrarNotificacion("⚠️ No hay productos.", "error"); return; }
    try {
      const respuesta = await fetch(`${API_BASE}/productos/surtir_masivo`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Tienda-ID': idTienda }, 
        body: JSON.stringify({ productos: productosValidos })
      });
      if (respuesta.ok) {
        const data = await respuesta.json();
        mostrarNotificacion(`✅ ${data.mensaje}`);
        setListaSurtido([]); cargarInventario(); 
      }
    } catch (error) { mostrarNotificacion("Error con el servidor Flask", "error"); }
  }

  const agregarAListaApagonDirecto = (producto) => {
    if (!producto) return;
    const indexExistente = listaApagon.findIndex(item => String(item.codigo) === String(producto.codigo));
    if (indexExistente >= 0) {
      const productoActualizado = { ...listaApagon[indexExistente], cantidad: float(listaApagon[indexExistente].cantidad) + 1 };
      const listaFiltrada = listaApagon.filter((_, idx) => idx !== indexExistente);
      setListaApagon([productoActualizado, ...listaFiltrada]);
    } else {
      setListaApagon([{ ...producto, cantidad: 1 }, ...listaApagon]);
    }
    setBusquedaApagon('');
  }

  const manejarEscaneoApagon = (e) => {
    e.preventDefault();
    if (!busquedaApagon.trim()) return;
    if (productoExactoApagon) agregarAListaApagonDirecto(productoExactoApagon);
    else if (sugerenciasApagon.length > 0) agregarAListaApagonDirecto(sugerenciasApagon[0]);
    else { mostrarNotificacion("❌ Producto no encontrado.", "error"); setBusquedaApagon(''); }
  }

  const modificarCantidadApagon = (index, nuevaCantidad) => {
    const nuevaLista = [...listaApagon];
    if (nuevaCantidad === '') { nuevaLista[index].cantidad = ''; setListaApagon(nuevaLista); return; }
    const candy = parseFloat(nuevaCantidad);
    if (isNaN(candy) && nuevaCantidad !== '.') return;
    if (candy < 0) return;
    nuevaLista[index].cantidad = nuevaCantidad;
    setListaApagon(nuevaLista);
  }

  const quitarDeListaApagon = (indexAQuitar) => setListaApagon(listaApagon.filter((_, idx) => idx !== indexAQuitar));

  const procesarApagonMasivo = async () => {
    const carritoFinal = listaApagon.map(item => ({ ...item, cantidad: item.cantidad === '' ? 1 : float(item.cantidad) }));
    if (carritoFinal.length === 0) return;
    let totalApagon = 0; carritoFinal.forEach(item => { totalApagon += (float(item.precio) * float(item.cantidad)); });

    const confirmacion = window.confirm(`⚡ Vas a procesar $${formatearDinero(totalApagon)} MXN.\n\n¿Deseas continuar?`);
    if (!confirmacion) return;

    try {
      const respuesta = await fetch(`${API_BASE}/ventas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Tienda-ID': idTienda }, 
        body: JSON.stringify({ carrito: carritoFinal, total: totalApagon })
      });
      if (respuesta.ok) {
        mostrarNotificacion(`✅ ¡Libreta registrada!`);
        setListaApagon([]); cargarInventario(); 
      }
    } catch (error) { mostrarNotificacion("Error conectando con el servidor.", "error"); }
  }

  const quitarProducto = (indexAQuitar) => setCarrito(carrito.filter((_, index) => index !== indexAQuitar));

  const modificarCantidad = (index, nuevaCantidad) => {
    const nuevoCarrito = [...carrito];
    if (nuevaCantidad === '') { nuevoCarrito[index].cantidad = ''; setCarrito(nuevoCarrito); return; }
    const candy = parseFloat(nuevaCantidad);
    if (isNaN(candy) && nuevaCantidad !== '.') return;
    if (candy < 0) return;
    
    const productoActual = carrito[index];
    const productoEnInventario = (listaInventario || []).find(item => String(item.codigo) === String(productoActual.codigo));
    const stockReal = productoEnInventario && productoEnInventario.stock !== undefined ? float(productoEnInventario.stock) : 0;

    if (productoEnInventario && candy > stockReal) {
      mostrarNotificacion(`⚠️ ¡Producto insuficiente! Solo hay ${stockReal} disponibles.`, "error");
      return;
    }
    nuevoCarrito[index].cantidad = nuevaCantidad; 
    setCarrito(nuevoCarrito);
  }

  const calcularTotal = () => { let suma = 0; carrito.forEach(item => { suma += (float(item.precio) * (item.cantidad === '' ? 0 : float(item.cantidad))); }); return suma; }
  const totalVenta = calcularTotal();

  const generarPDFTicket = (venta) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text("TICKET DE VENTA", 14, 20); doc.setFontSize(16); 
      doc.text(nombreTienda.toUpperCase(), 14, 28);
      const fechaObj = new Date(venta.fecha);
      doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(`Fecha: ${fechaObj.toLocaleDateString()}`, 14, 38); doc.text(`Hora: ${fechaObj.toLocaleTimeString()}`, 14, 45);
      const folioAleatorio = Math.floor(100000 + Math.random() * 900000); doc.text(`Folio Venta: #${folioAleatorio}`, 14, 52);
      const columnasTicket = ["Articulo", "Cont.", "Cant.", "Precio U.", "Subtotal"];
      const filasTicket = (venta.articulos || []).map(item => [ item.nombre || 'Articulo', formatoContenido(item), float(item.cantidad), `$${formatearDinero(item.precio)}`, `$${formatearDinero(float(item.precio) * float(item.cantidad))}` ]);
      autoTable(doc, { startY: 60, head: [columnasTicket], body: filasTicket, headStyles: { fillColor: [233, 30, 99] }, styles: { fontSize: 10 } });
      const finalY = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(`TOTAL COBRADO: $${formatearDinero(venta.total)} MXN`, 14, finalY);
      doc.setFontSize(11); doc.setFont("helvetica", "italic"); doc.text("¡Muchas gracias por su preferencia!", 14, finalY + 12); doc.text("Conserve este ticket para cualquier aclaracion.", 14, finalY + 18);
      
      const nombreArchivoSeguro = nombreTienda.replace(/\s+/g, '_').toUpperCase();
      doc.save(`Ticket_${nombreArchivoSeguro}_${folioAleatorio}.pdf`);
    } catch (error) { console.error("Error creando el ticket PDF:", error); }
  }

  const cobrarVentaConfirmada = async () => {
    if (carrito.length === 0 || procesandoCobro) return; 
    
    const carritoFinal = carrito.map(item => ({ ...item, cantidad: item.cantidad === '' ? 1 : float(item.cantidad) }));
    const totalVentaVal = calcularTotal();
    const pago = parseFloat(String(pagoCliente).replace(/,/g, '')) || 0;
    
    if (pago < totalVentaVal) { mostrarNotificacion("⚠️ El dinero recibido es menor al total a pagar.", "error"); return; }
    
    const cambio = pago - totalVentaVal;

    setProcesandoCobro(true);

    try {
      const respuesta = await fetch(`${API_BASE}/ventas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Tienda-ID': idTienda }, 
        body: JSON.stringify({ carrito: carritoFinal, total: totalVentaVal, pago_con: pago, cambio: cambio })
      });
      if (respuesta.ok) {
        mostrarNotificacion(`✅ ¡Cobro exitoso!\nTotal: $${formatearDinero(totalVentaVal)} | Cambio: $${formatearDinero(cambio)}`);
        setCarrito([]); setPagoCliente(''); setModalCobro(false); setCodigo(''); 
        cargarInventario(); 
        setTimeout(() => { if(inputRef.current) inputRef.current.focus(); }, 100); 
      }
    } catch (error) { 
      mostrarNotificacion("Error conectando con el servidor.", "error"); 
    } finally {
      setProcesandoCobro(false);
    }
  }

  const procesarDevolucion = async (tipo) => {
    let payload = { tipo: tipo };

    if (tipo === 'parcial') {
      const productos_a_devolver = []; const articulos_restantes = []; let nuevo_total = 0;
      ticketSeleccionado.articulos.forEach((art, index) => {
        const devueltos = float(cantidadesDevolucion[index] || 0); const seQuedan = float(art.cantidad) - devueltos;
        if (devueltos > 0) productos_a_devolver.push({ codigo: art.codigo, cantidad_devuelta: devueltos });
        if (seQuedan > 0) { articulos_restantes.push({ ...art, cantidad: seQuedan }); nuevo_total += (float(art.precio) * seQuedan); }
      });
      if (productos_a_devolver.length === 0) { mostrarNotificacion("⚠️ No has seleccionado ningún producto.", "error"); return; }
      payload.productos_a_devolver = productos_a_devolver; payload.articulos_restantes = articulos_restantes; payload.nuevo_total = nuevo_total;
    }

    const confirmacion = window.confirm(
      tipo === 'simple' ? "¿Seguro? Se borrará el ticket PERO el stock NO regresará al almacén." :
      tipo === 'completa' ? "¿Seguro? Se borrará el ticket y TODOS los productos volverán al almacén." :
      "¿Confirmas que deseas devolver estos productos seleccionados al almacén?"
    );

    if (confirmacion) {
      try {
        const respuesta = await fetch(`${API_BASE}/ventas/devolver/${ticketSeleccionado._id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Tienda-ID': idTienda }, body: JSON.stringify(payload)
        });
        if (respuesta.ok) {
          const data = await respuesta.json();
          mostrarNotificacion(data.mensaje);
          setModalDevolucion(false); setTicketSeleccionado(null); cargarHistorialVentas(); cargarInventario(); 
        }
      } catch (error) { mostrarNotificacion("Error conectando con el servidor", "error"); }
    }
  }

  const vaciarHistorialCompleto = async () => {
    const primero = window.confirm("🚨 ¡ALERTA CRÍTICA! Borrarás ABSOLUTAMENTE TODAS las ventas. ¿Deseas continuar?");
    if (primero) {
      const segundo = window.confirm("❓ ¿Seguro? Esta acción NO se puede deshacer y el Corte de Caja quedará en $0.00.");
      if (segundo) {
        try {
          const respuesta = await fetch(`${API_BASE}/ventas/reiniciar`, { method: 'DELETE', headers: { 'Tienda-ID': idTienda } });
          if (respuesta.ok) { mostrarNotificacion("💥 Todo el historial ha sido eliminado correctamente."); cargarHistorialVentas(); }
        } catch (error) { mostrarNotificacion("Error conectando con el servidor", "error"); }
      }
    }
  }

  const buscarProductoAPI = async (codigoEscaneado) => {
    if (!codigoEscaneado || codigoEscaneado.length < 5) {
      return;
    }

    mostrarNotificacion("🔎 Buscando producto en la nube...");

    try {
      const respuesta = await fetch(`https://world.openfoodfacts.org/api/v0/product/${codigoEscaneado}.json`);
      const data = await respuesta.json();

      if (data.status === 1 && data.product) {
        const nombreAPI = data.product.product_name_es || data.product.product_name || '';
        let cantidadAPI = data.product.quantity || '';
        const imagenAPI = data.product.image_url || '';
        
        let unidadDetectada = 'pza';
        let contenidoDetectado = '';

        if (cantidadAPI) {
          const cantLower = cantidadAPI.toLowerCase();
          if (cantLower.includes('ml')) { unidadDetectada = 'ml'; contenidoDetectado = cantLower.replace(/[^\d.]/g, ''); }
          else if (cantLower.includes('kg')) { unidadDetectada = 'kg'; contenidoDetectado = cantLower.replace(/[^\d.]/g, ''); }
          else if (cantLower.includes('g') && !cantLower.includes('kg')) { unidadDetectada = 'g'; contenidoDetectado = cantLower.replace(/[^\d.]/g, ''); }
          else if (cantLower.includes('l') && !cantLower.includes('ml')) { unidadDetectada = 'L'; contenidoDetectado = cantLower.replace(/[^\d.]/g, ''); }
        }

        setNuevoProd(prev => ({
          ...prev,
          nombre: nombreAPI || prev.nombre,
          tipo_unidad: unidadDetectada,
          contenido: contenidoDetectado || prev.contenido,
          imagen: imagenAPI || prev.imagen
        }));

        mostrarNotificacion(`✨ ¡Producto detectado! Precio por favor.`);
        setTimeout(() => { 
          const precioInput = document.getElementById('input-precio-venta');
          if(precioInput) precioInput.focus(); 
        }, 150);

      } else {
        mostrarNotificacion("❌ No se encontró en la base de datos mundial.", "error"); 
      }
    } catch (error) {
      console.error(error);
      mostrarNotificacion("❌ Error de la API en la nube.", "error"); 
    }
  }

  const guardarProducto = async (e) => {
    if (e) e.preventDefault();
    try {
      const respuesta = await fetch(`${API_BASE}/productos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Tienda-ID': idTienda }, body: JSON.stringify(nuevoProd)
      });
      if (respuesta.ok) {
        mostrarNotificacion("✅ Producto guardado con éxito");
        // 🔥 Limpia la categoría para que quede en "Abarrotes" otra vez
        setNuevoProd({ codigo: '', nombre: '', precio: '', precio_compra: '', stock: '', tipo_unidad: 'pza', contenido: '', categoria: 'Abarrotes', imagen: '' });
        cargarInventario();
      }
    } catch (error) { mostrarNotificacion("Error conectando con el servidor", "error"); }
  }

  const guardarEdicion = async (e) => {
    if (e) e.preventDefault();
    try {
      const codigoSeguro = encodeURIComponent(productoEditando.codigo);
      const respuesta = await fetch(`${API_BASE}/productos/${codigoSeguro}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Tienda-ID': idTienda }, 
        body: JSON.stringify({ 
          nombre: productoEditando.nombre, 
          precio: productoEditando.precio, 
          precio_compra: productoEditando.precio_compra, 
          stock: productoEditando.stock, 
          tipo_unidad: productoEditando.tipo_unidad, 
          contenido: productoEditando.contenido, 
          categoria: productoEditando.categoria || 'Sin Asignar', // 🔥 FIX PARA QUE NO PIERDA CATEGORÍA
          imagen: productoEditando.imagen || ''
        })
      });
      if (respuesta.ok) { 
        mostrarNotificacion("✅ Producto actualizado correctamente!"); 
        setProductoEditando(null); 
        cargarInventario(); 
      } else {
        mostrarNotificacion("❌ Producto no encontrado en el servidor", "error");
      }
    } catch (error) { mostrarNotificacion("Error conectando con el servidor", "error"); }
  }

  const borrarProducto = async (codigoEliminar) => {
    const confirmar = window.confirm(`⚠️ ¿Estás seguro de que deseas borrar permanentemente este producto del sistema?`);
    if (confirmar) {
      try {
        const codigoSeguro = encodeURIComponent(codigoEliminar);
        const respuesta = await fetch(`${API_BASE}/productos/${codigoSeguro}`, { method: 'DELETE', headers: { 'Tienda-ID': idTienda } });
        const data = await respuesta.json();
        if (respuesta.ok) { 
          mostrarNotificacion(`🗑️ ${data.mensaje}`); 
          cargarInventario(); 
        } else {
          mostrarNotificacion(`❌ ${data.error || "No se pudo borrar"}`, "error");
        }
      } catch (error) { mostrarNotificacion("Error con el servidor", "error"); }
    }
  }

  const generarExcelCorte = () => {
    if (!datosCorte) { mostrarNotificacion("Aún no hay datos cargados para el corte.", "error"); return; }
    const filas = [
      [`📊 PUNTO DE VENTA - REPORTE DE CORTE DE CAJA - ${nombreTienda.toUpperCase()}`], [], 
      ["Fecha del Corte:", datosCorte.fecha_reporte || ''], ["Hora de Generación:", datosCorte.hora_corte || ''], ["Total de Tickets Emitidos:", datosCorte.total_ventas || 0],
      ["Efectivo Bruto en Caja:", `$${formatearDinero(datosCorte.total_dinero || 0)}`], ["Ganancia Neta Real:", `$${formatearDinero(datosCorte.total_ganancia || 0)}`], [], 
      ["Hora", "Venta Total", "Ganancia", "Desglose por Artículo"] 
    ];
    const ventasArray = datosCorte.detalles || [];
    ventasArray.forEach(venta => {
      if (!venta) return; const fechaObj = new Date(venta.fecha);
      const detalleArticulos = venta.articulos && venta.articulos.length > 0 
        ? venta.articulos.map(art => `• ${(art?.nombre || 'Articulo')} (${formatoContenido(art)}) x${art.cantidad}  -> Deja: $${formatearDinero((float(art?.precio) - float(art?.precio_compra)) * float(art?.cantidad))}`).join('  |  ') : 'Sin detalles';
      filas.push([ fechaObj.toLocaleTimeString(), `$${formatearDinero(venta.total)}`, `$${formatearDinero(calcularGananciaVenta(venta))}`, detalleArticulos ]);
    });
    filas.push([]); filas.push([ "RESULTADO FINAL:", `$${formatearDinero(datosCorte.total_dinero || 0)}`, `$${formatearDinero(datosCorte.total_ganancia || 0)}`, "SUMA TOTAL DEL DÍA" ]);
    const hoja = XLSX.utils.aoa_to_sheet(filas); hoja['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 80 }]; 
    const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, hoja, "Corte Diario");
    XLSX.writeFile(libro, `Corte_De_Caja_${nombreTienda.replace(/\s+/g, '_')}_${datosCorte.fecha_reporte || 'Reporte'}.xlsx`);
  }

  const generarPDFPorAcabar = () => {
    try {
      if (productosPorAcabar.length === 0) { mostrarNotificacion("¡Todo excelente! No hay productos con stock bajo en este momento."); return; }
      const doc = new jsPDF();
      doc.setFontSize(22); doc.setTextColor(211, 47, 47); doc.setFont("helvetica", "bold"); doc.text(`LISTA DE PRODUCTOS POR SURTIR - ${nombreTienda.toUpperCase()}`, 14, 20); doc.setFontSize(12); doc.setTextColor(100, 100, 100);
      const fechaHoy = new Date().toLocaleDateString(); const horaHoy = new Date().toLocaleTimeString();
      doc.text(`Generado el: ${fechaHoy} a las ${horaHoy}`, 14, 28); doc.text("Entregar esta hoja al proveedor para reabastecer la tienda.", 14, 34);
      const productosOrdenados = [...productosPorAcabar].sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || '')));
      const columnasTabla = ["Código", "Producto", "Contenido", "Stock Actual"];
      const filasTabla = productosOrdenados.map(p => [ String(p?.codigo || ''), String(p?.nombre || 'Sin nombre'), formatoContenido(p), `${p?.stock !== undefined ? p.stock : 0} pzas/kg.` ]);
      autoTable(doc, { startY: 45, head: [columnasTabla], body: filasTabla, headStyles: { fillColor: [211, 47, 47] }, styles: { fontSize: 11, cellPadding: 4, valign: 'middle' }, columnStyles: { 3: { textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' } } });
      doc.save(`Lista_Proveedor_${nombreTienda.replace(/\s+/g, '_')}_${fechaHoy.replace(/\//g, '-')}.pdf`);
    } catch (error) { console.error("Error al crear el PDF de faltantes:", error); }
  }

  // 🔥 AQUÍ ESTÁ EL FIX: LOS VIEJOS VAN A "Sin Asignar"
  const productosFiltrados = (listaInventario || []).filter(item => {
      if (!item) return false;
      const categoriaDelProducto = item.categoria || 'Sin Asignar'; // <-- Magia arreglada
      const pasaCategoria = filtroCategoria === 'Todos' || categoriaDelProducto === filtroCategoria;
      const termino = String(busquedaAlmacen || '').trim().toLowerCase();
      const nom = String(item.nombre || '').toLowerCase(); const cod = String(item.codigo || '').toLowerCase();
      const pasaBusqueda = (nom.includes(termino) || cod.includes(termino));
      
      return pasaCategoria && pasaBusqueda;
    }).sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || '')));

  const p_Real = parseFloat(String(pagoCliente).replace(/,/g, '')) || 0;

  if (!idTienda) {
    return (
      <div translate="no" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f6f9', fontFamily: 'sans-serif', padding: '20px', boxSizing: 'border-box' }}>
        
        {notificacion.visible && (
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', backgroundColor: notificacion.tipo === 'error' ? '#f44336' : '#4CAF50', color: 'white', padding: '20px 30px', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', zIndex: 100000, fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span>{notificacion.tipo === 'error' ? '❌' : '✅'}</span>
            <div>{notificacion.mensaje}</div>
          </div>
        )}

        <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '12px', width: '100%', maxWidth: '420px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e0e0e0', textAlign: 'center' }}>
          
          <div style={{ marginBottom: '25px' }}>
            <h1 style={{ margin: 0, color: '#1a1a1a', fontSize: '42px', fontWeight: '900', letterSpacing: '2px', fontStyle: 'italic' }}>
              Vazcam
            </h1>
          </div>

          <form onSubmit={manejarLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#444', display: 'block', marginBottom: '6px', fontSize: '15px' }}>Usuario del Comercio:</label>
              <input ref={loginInputRef} type="text" value={usuarioInput} onChange={(e) => setUsuarioInput(e.target.value)} required placeholder="Introduce tu usuario..." style={{ width: '100%', padding: '12px 15px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', outline: 'none', backgroundColor: '#f9f9f9', color: '#1a1a1a' }} />
            </div>

            <div>
              <label style={{ fontWeight: 'bold', color: '#444', display: 'block', marginBottom: '6px', fontSize: '15px' }}>Contraseña:</label>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required placeholder="••••••••" style={{ width: '100%', padding: '12px 15px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', outline: 'none', backgroundColor: '#f9f9f9', color: '#1a1a1a' }} />
            </div>

            <button type="submit" style={{ width: '100%', padding: '15px', fontSize: '18px', fontWeight: 'bold', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 12px rgba(33,150,243,0.3)', transition: 'background-color 0.2s' }}>
              🚀 Ingresar al Sistema
            </button>
          </form>

        </div>
      </div>
    );
  }

  return (
    <div translate="no" style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f4f6f9', color: '#1a1a1a', minHeight: '100vh' }}>
      
      <style>{`
        @keyframes deslizarArriba {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {notificacion.visible && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', backgroundColor: notificacion.tipo === 'error' ? '#f44336' : notificacion.mensaje.includes('⚠️') ? '#FF9800' : '#4CAF50', color: 'white', padding: '20px 30px', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', zIndex: 100000, fontSize: '18px', fontWeight: 'bold', whiteSpace: 'pre-wrap', display: 'flex', alignItems: 'center', gap: '15px', animation: 'deslizarArriba 0.3s ease-out' }}>
          <span style={{ fontSize: '28px' }}>
            {notificacion.tipo === 'error' ? '❌' : notificacion.mensaje.includes('⚠️') ? '⚠️' : '✅'}
          </span>
          <div>{notificacion.mensaje.replace(/✅|❌|⚠️|💥|🗑️/g, '').trim()}</div>
        </div>
      )}

      {/* 🚀 BARRA DE NAVEGACIÓN */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', borderBottom: '1px solid #ccc', paddingBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => setPantalla('ventas')} style={{ padding: '10px 20px', backgroundColor: pantalla === 'ventas' ? '#2196F3' : '#e0e0e0', color: pantalla === 'ventas' ? 'white' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>🛒 Punto de Venta</button>
        <button onClick={() => setPantalla('inventario')} style={{ padding: '10px 20px', backgroundColor: pantalla === 'inventario' ? '#2196F3' : '#e0e0e0', color: pantalla === 'inventario' ? 'white' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>➕ Inventario</button>
        <button onClick={() => setPantalla('almacen')} style={{ padding: '10px 20px', backgroundColor: pantalla === 'almacen' ? '#2196F3' : '#e0e0e0', color: pantalla === 'almacen' ? 'white' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>📋 Ver Almacén</button>
        <button onClick={() => setPantalla('apagon')} style={{ padding: '10px 20px', backgroundColor: pantalla === 'apagon' ? '#673AB7' : '#e0e0e0', color: pantalla === 'apagon' ? 'white' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>⚡ Modo Apagón</button>

        <button onClick={() => setPantalla('por_acabar')} style={{ position: 'relative', padding: '10px 20px', backgroundColor: pantalla === 'por_acabar' ? '#d32f2f' : '#e0e0e0', color: pantalla === 'por_acabar' ? 'white' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>
          ⚠️ Por Acabar
          {cantidadStockBajo > 0 && (
            <span style={{ position: 'absolute', top: '-8px', right: '-8px', backgroundColor: '#d32f2f', color: 'white', borderRadius: '50%', padding: '4px 8px', fontSize: '13px', fontWeight: 'bold', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              {cantidadStockBajo}
            </span>
          )}
        </button>

        <button onClick={() => setPantalla('tickets')} style={{ padding: '10px 20px', backgroundColor: pantalla === 'tickets' ? '#E91E63' : '#e0e0e0', color: pantalla === 'tickets' ? 'white' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>🧾 Tickets</button>
        <button onClick={() => setPantalla('corte')} style={{ padding: '10px 20px', backgroundColor: pantalla === 'corte' ? '#FF9800' : '#e0e0e0', color: pantalla === 'corte' ? 'white' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>📊 Corte de Caja</button>
      </div>

      {/* 🔥 CAJA DE STOCK BAJO TIPO ACORDEÓN */}
      {cantidadStockBajo > 0 && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '6px', marginBottom: '20px', border: '1px solid #f5c6cb', overflow: 'hidden' }}>
          <div 
            onClick={() => setMostrarListaStock(!mostrarListaStock)} 
            style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', backgroundColor: mostrarListaStock ? '#f5c6cb' : 'transparent', transition: 'background-color 0.2s' }}
            title="Clic para ver/ocultar los productos"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <strong>¡Notificación de Stock Bajo! Tienes {cantidadStockBajo} producto(s) por agotarse.</strong>
            </div>
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {mostrarListaStock ? '▲' : '▼'}
            </span>
          </div>
          
          {mostrarListaStock && (
            <div style={{ padding: '15px', borderTop: '1px solid #f5c6cb', fontSize: '15px', lineHeight: '1.5' }}>
              {productosPorAcabar.map((p, idx, arr) => (
                <span key={p?.codigo || idx} style={{ fontWeight: 'bold', color: '#721c24' }}>
                  {p?.nombre || 'Sin nombre'} ({p?.stock !== undefined ? p.stock : 0} cant.){idx < arr.length - 1 ? ', ' : ''}
                </span>
              ))}
              .
            </div>
          )}
        </div>
      )}

      {/* ⚡ PANTALLA: MODO APAGÓN */}
      {pantalla === 'apagon' && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '8px', width: '800px', border: '1px solid #673AB7', boxShadow: '0 4px 10px rgba(103,58,183,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
              <span style={{ fontSize: '40px' }}>⚡</span>
              <h2 style={{ color: '#673AB7', margin: '0', fontSize: '32px' }}>Carga Rápida de Libreta</h2>
            </div>
            <p style={{ color: '#555', fontSize: '16px', marginBottom: '25px' }}>Usa este módulo para vaciar todas las ventas que se anotaron a mano cuando se fue la luz.</p>

            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <form onSubmit={manejarEscaneoApagon}>
                <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '20px', color: '#666' }}>🔍</span>
                <input type="text" value={busquedaApagon} onChange={(e) => setBusquedaApagon(e.target.value)} placeholder="Busca producto por código o nombre..." style={{ padding: '12px 12px 12px 45px', fontSize: '18px', width: '100%', borderRadius: '6px', border: '2px solid #673AB7', backgroundColor: '#f3e5f5', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box', fontWeight: 'bold' }} />
              </form>
              {sugerenciasApagon.length > 0 && (
                <div style={{ position: 'absolute', top: '50px', left: '0', width: '100%', backgroundColor: '#ffffff', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0px 4px 12px rgba(0,0,0,0.15)', zIndex: '10', maxHeight: '200px', overflowY: 'auto' }}>
                  {sugerenciasApagon.map((prod, idx) => (
                    <div key={idx} onClick={() => agregarAListaApagonDirecto(prod)} style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', backgroundColor: '#fff' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ede7f6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}>
                      <div>
                        <strong style={{ color: '#1a1a1a' }}>{String(prod?.nombre || 'Sin nombre')}</strong>
                        <span style={{ fontSize: '12px', color: '#666', display: 'block' }}>Cód: {String(prod?.codigo || '')} | Stock: {prod?.stock !== undefined ? float(prod.stock) : 0}</span>
                      </div>
                      <strong style={{ color: '#673AB7' }}>${formatearDinero(prod?.precio)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '6px', marginBottom: '20px' }}>
              <table border="0" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#ede7f6', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '10px', color: '#333' }}>Producto</th>
                    <th style={{ padding: '10px', color: '#333', textAlign: 'center', width: '120px' }}>Cant. Vendida</th>
                    <th style={{ padding: '10px', color: '#333', textAlign: 'right' }}>Subtotal</th>
                    <th style={{ padding: '10px', color: '#333', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {listaApagon.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px', color: '#1a1a1a', fontWeight: 'bold' }}>{String(item?.nombre || 'Sin nombre')}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input 
                          type="number" step="any" min="0" value={item.cantidad} 
                          onChange={(e) => modificarCantidadApagon(idx, e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && procesarApagonMasivo()}
                          style={{ width: '80px', padding: '6px', border: '2px solid #673AB7', borderRadius: '4px', textAlign: 'center', color: '#1a1a1a', fontWeight: 'bold' }} 
                        />
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#1a1a1a' }}>
                        ${formatearDinero(float(item?.precio) * (item.cantidad === '' ? 0 : float(item.cantidad)))}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => quitarDeListaApagon(idx)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontWeight: 'bold' }}>Quitar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={procesarApagonMasivo} style={{ width: '100%', padding: '18px', backgroundColor: '#673AB7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(103,58,183,0.3)' }}>
              ⚡ Registrar Todas las Ventas de la Libreta
            </button>
          </div>
        </div>
      )}

      {/* PANTALLA: PUNTO DE VENTA */}
      {pantalla === 'ventas' && (
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: '2' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              
              <div style={{ position: 'relative', flex: '1', maxWidth: '450px' }}>
                <form onSubmit={manejarEscaneo}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '20px', color: '#666' }}>🔍</span>
                  <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus ref={inputRef} placeholder="Escanea el código o teclea la clave corta..." style={{ padding: '12px 12px 12px 45px', fontSize: '18px', width: '100%', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', outline: 'none', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)', boxSizing: 'border-box' }} />
                </form>
                {sugerenciasVentas.length > 0 && (
                  <div style={{ position: 'absolute', top: '48px', left: '0', width: '100%', backgroundColor: '#ffffff', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0px 4px 12px rgba(0,0,0,0.15)', zIndex: '10', maxHeight: '200px', overflowY: 'auto' }}>
                    {sugerenciasVentas.map((prod, idx) => (
                      <div key={idx} onClick={() => agregarAlCarritoDirecto(prod)} style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', backgroundColor: idx === 0 ? '#f0f4f8' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2196F3'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx === 0 ? '#f0f4f8' : 'transparent'}>
                        
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          {prod.imagen ? <img src={prod.imagen} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #ccc' }} alt="img" /> : <span style={{ fontSize: '24px' }}>📦</span>}
                          <div>
                            <strong style={{ color: '#1a1a1a' }}>{String(prod?.nombre || 'Sin nombre')} </strong>
                            <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 'bold' }}>{formatoContenido(prod)}</span>
                            <span style={{ fontSize: '12px', color: '#666', display: 'block' }}>Cód: {String(prod?.codigo || '')}</span>
                          </div>
                        </div>
                        
                        <div style={{ textAlign: 'right' }}><span style={{ color: '#1a1a1a', fontWeight: 'bold' }}>${formatearDinero(prod?.precio)}</span><span style={{ fontSize: '12px', color: (prod?.stock !== undefined ? float(prod.stock) : 0) <= 3 ? '#d32f2f' : '#1a1a1a', display: 'block' }}>Stock: {prod?.stock !== undefined ? float(prod.stock) : 0}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <h1 style={{ margin: 0, color: '#1a1a1a', fontSize: '30px', fontWeight: '900', letterSpacing: '1px', fontStyle: 'italic', textTransform: 'uppercase' }}>
                  {(() => {
                    let nombreLimpio = (nombreTienda || 'MI TIENDA').replace(/abarrotes|mini super|mini|super|tienda|miscelanea|miscelánea/gi, '').trim();
                    if (!nombreLimpio) nombreLimpio = nombreTienda; 
                    const partes = nombreLimpio.split(' ');
                    if (partes.length === 1) return <span style={{ color: '#2196F3' }}>{partes[0]}</span>;
                    const ultima = partes.pop();
                    return <>{partes.join(' ')} <span style={{ color: '#2196F3' }}>{ultima}</span></>;
                  })()}
                </h1>
                <div style={{ height: '40px', width: '3px', backgroundColor: '#e0e0e0', borderRadius: '2px' }}></div> 
                
                <img src={patoImg} alt="Marca del Desarrollador" title="Software Desarrollado por Ing. Juan Luis" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #2196F3', boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }} />
                
                <button onClick={() => setModalLogout(true)} title="Cerrar Sesión de Caja" style={{ background: '#e0e0e0', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', color: '#333' }}>🚪</button>
              </div>
            </div>
            
            <table border="1" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', borderColor: '#ccc' }}>
              <thead style={{ backgroundColor: '#e9ecef' }}>
                <tr>
                  <th style={{ padding: '10px', color: '#333', width: '50px', textAlign: 'center' }}>Img</th>
                  <th style={{ padding: '10px', color: '#333' }}>Código</th>
                  <th style={{ padding: '10px', color: '#333' }}>Nombre</th>
                  <th style={{ padding: '10px', color: '#333' }}>Contenido</th>
                  <th style={{ padding: '10px', color: '#333' }}>Precio</th>
                  <th style={{ padding: '10px', width: '90px', color: '#333' }}>Cant/Kg</th>
                  <th style={{ padding: '10px', color: '#333' }}>Subtotal</th>
                  <th style={{ padding: '10px', color: '#333' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {carrito.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #ccc', backgroundColor: '#ffffff' }}>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {item.imagen ? <img src={item.imagen} alt="img" style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #ccc' }} /> : <span style={{ fontSize: '24px' }}>📦</span>}
                    </td>
                    <td style={{ padding: '10px', color: '#1a1a1a' }}>{String(item?.codigo || '')}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#1a1a1a' }}>{String(item?.nombre || 'Sin nombre')}</td>
                    <td style={{ padding: '10px', color: '#1a1a1a', fontWeight: 'bold' }}>{formatoContenido(item)}</td>
                    <td style={{ padding: '10px', color: '#1a1a1a', fontWeight: 'bold' }}>${formatearDinero(item?.precio)}</td>
                    <td style={{ padding: '10px' }}>
                      <input type="number" step="any" min="0" value={item.cantidad} onChange={(e) => modificarCantidad(index, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setModalCobro(true)} style={{ width: '70px', padding: '5px', borderRadius: '3px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', textAlign: 'center', boxSizing: 'border-box' }} />
                    </td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#1a1a1a' }}>${formatearDinero(float(item?.precio) * (item.cantidad === '' ? 0 : float(item.cantidad)))}</td>
                    <td style={{ padding: '10px' }}><button onClick={() => quitarProducto(index)} style={{ backgroundColor: '#d32f2f', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ flex: '1', backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', height: 'fit-content', border: '1px solid #ccc', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 20px 0', color: '#555' }}>Resumen de Venta</h2>
            <h1 style={{ textAlign: 'center', color: '#1a1a1a', fontSize: '48px', margin: '0 0 20px 0' }}>${formatearDinero(totalVenta)}</h1>
            <button onClick={() => setModalCobro(true)} style={{ width: '100%', padding: '20px', fontSize: '24px', fontWeight: 'bold', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(33,150,243,0.2)' }}>💵 COBRAR</button>
          </div>
        </div>
      )}

      {/* PANTALLA: INVENTARIO */}
      {pantalla === 'inventario' && (
        <div style={{ display: 'flex', gap: '40px' }}>
          <div style={{ flex: '1' }}>
            <h2>Registrar Producto Nuevo</h2>
            <form onSubmit={guardarProducto} style={{ display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #ccc' }}>
              <div>
                <label>Código o Clave Corta:</label>
                <input type="text" value={nuevoProd.codigo} onChange={(e) => setNuevoProd({...nuevoProd, codigo: e.target.value})} 
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') { 
                      e.preventDefault(); 
                      const codEscaneado = String(e.target.value).trim();
                      const prodRepetido = (listaInventario || []).find(item => String(item?.codigo || '') === codEscaneado);
                      
                      if (prodRepetido) {
                        mostrarNotificacion(`⚠️ El producto "${prodRepetido.nombre || 'Este producto'}" ya está registrado en tu almacén.`, "error");
                      } else {
                        buscarProductoAPI(codEscaneado); 
                      }
                    } 
                  }} 
                  required placeholder="Ej. JITO o 75010313..." style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', color: '#1a1a1a', boxSizing: 'border-box' }} 
                />
              </div>
              
              <div><label>Nombre:</label><input id="input-nombre" type="text" value={nuevoProd.nombre} onChange={(e) => setNuevoProd({...nuevoProd, nombre: e.target.value})} required placeholder="Ej. Jitomate Saladet" style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
              
              <div><label>Link de la Imagen (Opcional):</label><input type="text" value={nuevoProd.imagen} onChange={(e) => setNuevoProd({...nuevoProd, imagen: e.target.value})} placeholder="Pega el link de la foto aquí o escanea para buscar automático..." style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>

              {/* 🔥 SELECTOR CON "Sin Asignar" AÑADIDO */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                <div style={{ flex: '1' }}>
                  <label>Categoría del Bloque:</label>
                  <select value={nuevoProd.categoria || 'Abarrotes'} onChange={(e) => setNuevoProd({...nuevoProd, categoria: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', color: '#1a1a1a', boxSizing: 'border-box' }}>
                    <option value="Abarrotes">Abarrotes</option>
                    <option value="Frutas y Verduras">Frutas y Verduras</option>
                    <option value="Limpieza">Limpieza</option>
                    <option value="Cosméticos">Cosméticos</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Sin Asignar">Sin Asignar</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                <div style={{ flex: '1' }}><label>Unidad de Medida:</label><select value={nuevoProd.tipo_unidad} onChange={(e) => setNuevoProd({...nuevoProd, tipo_unidad: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', color: '#1a1a1a', boxSizing: 'border-box' }}><option value="pza">Pieza Única (pza)</option><option value="kg">Kilogramos (kg)</option><option value="g">Gramos (g)</option><option value="ml">Mililitros (ml)</option><option value="L">Litros (L)</option></select></div>
                <div style={{ flex: '1' }}><label>Contenido neto:</label><input type="text" value={nuevoProd.contenido} onChange={(e) => setNuevoProd({...nuevoProd, contenido: e.target.value})} placeholder="Ej. 1, 600" style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                <div style={{ flex: '1' }}><label>Precio de Venta ($):</label><input id="input-precio-venta" type="number" step="any" value={nuevoProd.precio} onChange={(e) => setNuevoProd({...nuevoProd, precio: e.target.value})} required placeholder="Ej. 22.50" style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: '1' }}><label>Precio Proveedor ($):</label><input type="number" step="any" value={nuevoProd.precio_compra} onChange={(e) => setNuevoProd({...nuevoProd, precio_compra: e.target.value})} required placeholder="Ej. 15.00" style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
              </div>
              <div><label>Cantidad/Kilos inicial en tienda:</label><input type="number" step="any" min="0" value={nuevoProd.stock} onChange={(e) => setNuevoProd({...nuevoProd, stock: e.target.value})} required placeholder="Ej. 24.5" style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
              <button type="submit" style={{ padding: '12px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>💾 Registrar como Nuevo</button>
            </form>
          </div>
          <div style={{ flex: '1' }}>
            <h2>Surtir Cargamento por Lote</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#e3f2fd', padding: '20px', borderRadius: '8px', border: '1px solid #2196F3' }}>
              <div style={{ position: 'relative' }}>
                <label style={{ color: '#0d47a1', fontWeight: 'bold' }}>Escribe el nombre o escanea el producto:</label>
                <form onSubmit={manejarEscaneoSurtir}><input type="text" value={busquedaSurtir} onChange={(e) => setBusquedaSurtir(e.target.value)} placeholder="Ej. Sabritas, Manzana..." style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #2196F3', backgroundColor: '#ffffff', color: '#1a1a1a', boxSizing: 'border-box' }} /></form>
                {sugerenciasSurtir.length > 0 && (
                  <div style={{ position: 'absolute', top: '70px', left: '0', width: '100%', backgroundColor: '#ffffff', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0px 4px 12px rgba(0,0,0,0.15)', zIndex: '10', maxHeight: '160px', overflowY: 'auto' }}>
                    {sugerenciasSurtir.map((prod, idx) => (
                      <div key={idx} onClick={() => agregarAListaSurtidoDirecto(prod)} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: '#fff' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}>
                        <strong style={{ color: '#1a1a1a' }}>{obtenerNombreConMedida(prod)}</strong>
                        <span style={{ display: 'block', fontSize: '12px', color: '#666' }}>Cód: {String(prod?.codigo || '')} | Almacén: {prod?.stock !== undefined ? float(prod.stock) : 0} cant.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <h3 style={{ margin: '10px 0 0 0', color: '#0d47a1' }}>Lista del Cargamento Actual:</h3>
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}>
                <table border="0" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f5f5f5', position: 'sticky', top: 0 }}><tr><th style={{ padding: '8px', fontSize: '13px' }}>Artículo</th><th style={{ padding: '8px', fontSize: '13px', width: '80px' }}>Llegaron</th><th style={{ padding: '8px', fontSize: '13px', textAlign: 'center' }}>Acción</th></tr></thead>
                  <tbody>
                    {listaSurtido.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px', fontSize: '13px' }}><strong style={{ display: 'block', color: '#1a1a1a' }}>{String(item?.nombre || 'Sin nombre')}</strong><span style={{ fontSize: '11px', color: '#1a1a1a', fontWeight: 'bold' }}>{formatoContenido(item)}</span></td>
                        <td style={{ padding: '8px' }}><input type="number" step="any" min="0" value={item.cantidad} onChange={(e) => modificarCantidadSurtido(idx, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aplicarCargamentoMasivo()} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '3px', textAlign: 'center', color: '#1a1a1a' }} /></td>
                        <td style={{ padding: '8px', textAlign: 'center' }}><button onClick={() => quitarDeListaSurtido(idx)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontWeight: 'bold' }}>Quitar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={aplicarCargamentoMasivo} style={{ padding: '15px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', marginTop: '5px', boxShadow: '0 4px 6px rgba(33,150,243,0.2)' }}>📦 Aplicar Todo el Cargamento</button>
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA: ALMACÉN */}
      {pantalla === 'almacen' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>Lista de Productos en Almacén</h2>
            <span style={{ backgroundColor: '#4CAF50', color: 'white', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              📦 Total Registrados: {listaInventario.length}
            </span>
          </div>

          {/* 🔥 BOTONERA CON "Sin Asignar" PARA LOS PRODUCTOS VIEJOS */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['Todos', 'Abarrotes', 'Frutas y Verduras', 'Limpieza', 'Cosméticos', 'Bebidas', 'Sin Asignar'].map(cat => (
              <button 
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  backgroundColor: filtroCategoria === cat ? '#2196F3' : '#e0e0e0',
                  color: filtroCategoria === cat ? 'white' : '#333',
                  boxShadow: filtroCategoria === cat ? '0 2px 4px rgba(33,150,243,0.3)' : 'none',
                  transition: '0.2s'
                }}
              >
                {cat === 'Todos' ? '📦 Total (Ver Todos)' : cat}
              </button>
            ))}
          </div>

          {productoEditando && (
            <div style={{ backgroundColor: '#fff8e1', padding: '20px', borderRadius: '8px', marginBottom: '20px', borderLeft: '5px solid #FF9800', border: '1px solid #ffe082' }}>
              <h3 style={{ marginTop: '0', color: '#b78103' }}>✏️ Editando: {String(productoEditando?.codigo || '')}</h3>
              <form onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                  <div style={{ flex: '2' }}><label>Nombre:</label><input type="text" value={productoEditando.nombre} onChange={(e) => setProductoEditando({...productoEditando, nombre: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: '1' }}><label>P. Venta ($):</label><input type="number" step="any" value={productoEditando.precio} onChange={(e) => setProductoEditando({...productoEditando, precio: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: '1' }}><label>P. Costo ($):</label><input type="number" step="any" value={productoEditando.precio_compra || ''} onChange={(e) => setProductoEditando({...productoEditando, precio_compra: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: '1' }}><label>Stock actual:</label><input type="number" step="any" value={productoEditando.stock} onChange={(e) => setProductoEditando({...productoEditando, stock: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
                </div>
                <div style={{ display: 'flex', gap: '20px', maxWidth: '800px', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1' }}><label>Unidad:</label>
                    <select value={productoEditando.tipo_unidad || 'pza'} onChange={(e) => setProductoEditando({...productoEditando, tipo_unidad: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', boxSizing: 'border-box' }}><option value="pza">Pieza (pza)</option><option value="kg">Kilogramos (kg)</option><option value="g">Gramos (g)</option><option value="ml">Mililitros (ml)</option><option value="L">Litros (L)</option></select>
                  </div>
                  <div style={{ flex: '1' }}><label>Contenido:</label><input type="text" value={productoEditando.contenido || ''} onChange={(e) => setProductoEditando({...productoEditando, contenido: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', boxSizing: 'border-box' }} /></div>
                  
                  {/* 🔥 SELECTOR CON "Sin Asignar" AÑADIDO */}
                  <div style={{ flex: '1' }}><label>Categoría:</label>
                    <select value={productoEditando.categoria || 'Sin Asignar'} onChange={(e) => setProductoEditando({...productoEditando, categoria: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', boxSizing: 'border-box' }}>
                      <option value="Abarrotes">Abarrotes</option>
                      <option value="Frutas y Verduras">Frutas y Verduras</option>
                      <option value="Limpieza">Limpieza</option>
                      <option value="Cosméticos">Cosméticos</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Sin Asignar">Sin Asignar</option>
                    </select>
                  </div>
                  
                  <div style={{ flex: '2' }}>
                    <label>Link Imagen:</label>
                    <input type="text" value={productoEditando.imagen || ''} onChange={(e) => setProductoEditando({...productoEditando, imagen: e.target.value})} placeholder="URL de la imagen..." style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', boxSizing: 'border-box' }} />
                  </div>

                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}><button type="submit" style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar</button><button type="button" onClick={() => setProductoEditando(null)} style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button></div>
              </form>
            </div>
          )}
          <div style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px', color: '#666' }}>🔍</span>
            <input type="text" placeholder={`Buscar en ${filtroCategoria === 'Todos' ? 'todos los bloques' : filtroCategoria}...`} value={busquedaAlmacen} onChange={(e) => setBusquedaAlmacen(e.target.value)} style={{ padding: '12px 15px', fontSize: '16px', width: '350px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#ffffff', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <table border="1" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', borderColor: '#ccc' }}>
            <thead style={{ backgroundColor: '#e9ecef' }}>
              <tr>
                <th style={{ padding: '10px', color: '#333', textAlign: 'center', width: '30px' }}>#</th>
                <th style={{ padding: '10px', color: '#333', textAlign: 'center', width: '50px' }}>Img</th>
                <th style={{ padding: '10px', color: '#333' }}>Código</th>
                <th style={{ padding: '10px', color: '#333' }}>Nombre</th>
                <th style={{ padding: '10px', color: '#333' }}>Categoría</th>
                <th style={{ padding: '10px', color: '#333' }}>Contenido</th>
                <th style={{ padding: '10px', color: '#333' }}>P. Venta</th>
                <th style={{ padding: '10px', color: '#333' }}>P. Costo</th>
                <th style={{ padding: '10px', color: '#333' }}>Ganancia/u</th>
                <th style={{ padding: '10px', color: '#333' }}>Stock</th>
                <th style={{ padding: '10px', color: '#333' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((item, index) => {
                const stockVal = item?.stock !== undefined ? float(item.stock) : 0;
                return (
                <tr key={index} style={{ borderBottom: '1px solid #ccc', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9' }}>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{index + 1}</td>
                  
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    {item.imagen ? <img src={item.imagen} alt="img" style={{ width: '35px', height: '35px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #ccc' }} /> : <span style={{ fontSize: '20px' }}>📦</span>}
                  </td>
                  
                  <td style={{ padding: '10px', color: '#1a1a1a' }}>{String(item?.codigo || '')}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#1a1a1a' }}>{String(item?.nombre || 'Sin nombre')}</td>
                  
                  {/* 🔥 FIX: LO QUE ESTÁ EN BLANCO AHORA SALE COMO "Sin Asignar" */}
                  <td style={{ padding: '10px', color: '#2196F3', fontWeight: 'bold' }}>{item.categoria || 'Sin Asignar'}</td>
                  
                  <td style={{ padding: '10px', color: '#1a1a1a', fontWeight: 'bold' }}>{formatoContenido(item)}</td>
                  <td style={{ padding: '10px', color: '#1a1a1a', fontWeight: 'bold' }}>${formatearDinero(item?.precio)}</td>
                  <td style={{ padding: '10px', color: '#1a1a1a', fontWeight: 'bold' }}>${formatearDinero(item?.precio_compra)}</td>
                  <td style={{ padding: '10px', color: '#1a1a1a', fontWeight: 'bold' }}>${formatearDinero(float(item?.precio) - float(item?.precio_compra))}</td>
                  <td style={{ padding: '10px', color: '#1a1a1a', fontWeight: 'bold' }}>{stockVal} cant.</td>
                  <td style={{ padding: '10px', display: 'flex', gap: '10px' }}>
                    <button onClick={() => setAuthModal({ visible: true, accion: 'editarProducto', parametro: item, titulo: `Editar ${item.nombre}` })} style={{ backgroundColor: '#FF9800', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Editar</button>
                    <button onClick={() => setAuthModal({ visible: true, accion: 'borrarProducto', parametro: item.codigo, titulo: `Borrar ${item.nombre}` })} style={{ backgroundColor: '#d32f2f', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Borrar</button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          {productosFiltrados.length === 0 && <p style={{ textAlign: 'center', marginTop: '40px', color: '#666', fontSize: '18px' }}>No hay productos en este bloque.</p>}
        </div>
      )}

      {/* PANTALLA: POR ACABAR */}
      {pantalla === 'por_acabar' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '32px' }}>⚠️</span>
              <h2 style={{ color: '#d32f2f', margin: '0' }}>Productos por Acabar (3 cant o menos)</h2>
            </div>
            <button onClick={generarPDFPorAcabar} style={{ backgroundColor: '#d32f2f', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(211,47,47,0.3)' }}>
              <span>📄</span> Descargar en PDF
            </button>
          </div>
          <p style={{ color: '#555', fontSize: '16px', marginBottom: '20px' }}>Esta lista te muestra únicamente los productos urgentes de resurtir.</p>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
            <table border="0" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#ffebee' }}><tr><th style={{ padding: '15px', color: '#d32f2f', borderBottom: '2px solid #ef9a9a' }}>Código</th><th style={{ padding: '15px', color: '#d32f2f', borderBottom: '2px solid #ef9a9a' }}>Nombre del Producto</th><th style={{ padding: '15px', color: '#d32f2f', borderBottom: '2px solid #ef9a9a' }}>Contenido</th><th style={{ padding: '15px', color: '#d32f2f', borderBottom: '2px solid #ef9a9a' }}>Stock Actual</th></tr></thead>
              <tbody>
                {productosPorAcabar.length > 0 ? (
                  productosPorAcabar.map((item, index) => {
                    const stockVal = item?.stock !== undefined ? float(item.stock) : 0;
                    return (
                      <tr key={index} style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '15px', color: '#1a1a1a' }}>{String(item?.codigo || '')}</td><td style={{ padding: '15px', fontWeight: 'bold', color: '#1a1a1a', fontSize: '18px' }}>{String(item?.nombre || 'Sin nombre')}</td><td style={{ padding: '15px', color: '#1a1a1a', fontWeight: 'bold' }}>{formatoContenido(item)}</td><td style={{ padding: '15px', color: '#1a1a1a', fontWeight: 'bold', fontSize: '18px' }}>{stockVal} cant.</td>
                      </tr>
                    );
                  })
                ) : ( <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#2e7d32', fontSize: '18px', fontWeight: 'bold' }}>¡Excelente! Tienes el almacén bien surtido.</td></tr> )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PANTALLA: TICKETS */}
      {pantalla === 'tickets' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}><span style={{ fontSize: '32px' }}>🧾</span><h2 style={{ color: '#E91E63', margin: '0' }}>Historial de Ventas y Tickets</h2></div>
            <button onClick={() => setAuthModal({ visible: true, accion: 'vaciarHistorial', parametro: null, titulo: 'Vaciar TODO el Historial' })} style={{ backgroundColor: '#fff', color: '#d32f2f', border: '1px solid #d32f2f', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>⚠️ Vaciar Historial Completo</button>
          </div>
          <table border="1" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', borderColor: '#ccc' }}>
            <thead style={{ backgroundColor: '#e9ecef' }}><tr><th style={{ padding: '10px', color: '#333' }}>Fecha y Hora</th><th style={{ padding: '10px', color: '#333' }}>Artículos Comprados</th><th style={{ padding: '10px', color: '#333' }}>Total Pagado</th><th style={{ padding: '10px', color: '#333' }}>Ganancia</th><th style={{ padding: '10px', textAlign: 'center', color: '#333' }}>Acciones</th></tr></thead>
            <tbody>
              {(historialVentas || []).map((venta, index) => {
                if (!venta) return null; const fechaObj = new Date(venta.fecha);
                return (
                  <tr key={index} style={{ borderBottom: '1px solid #ccc', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9' }}>
                    <td style={{ padding: '15px' }}><strong style={{ display: 'block', color: '#1a1a1a' }}>{fechaObj.toLocaleDateString()}</strong><span style={{ color: '#555', fontSize: '14px' }}>{fechaObj.toLocaleTimeString()}</span></td>
                    <td style={{ padding: '15px', color: '#1a1a1a' }}>{(venta.articulos || []).map(a => `${String(a?.nombre || 'Articulo')} (${formatoContenido(a)}) (x${float(a?.cantidad || 1)})`).join(', ')}</td>
                    <td style={{ padding: '15px', color: '#1a1a1a', fontWeight: 'bold', fontSize: '18px' }}>${formatearDinero(venta.total)}</td>
                    <td style={{ padding: '15px', color: '#1a1a1a', fontWeight: 'bold', fontSize: '18px' }}>${formatearDinero(calcularGananciaVenta(venta))}</td>
                    <td style={{ padding: '15px', display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
                      <button onClick={() => generarPDFTicket(venta)} style={{ backgroundColor: '#E91E63', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>⬇️</span> Descargar Ticket</button>
                      <button onClick={() => setAuthModal({ visible: true, accion: 'abrirDevolucion', parametro: venta, titulo: 'Opciones de Devolución de Ticket' })} style={{ backgroundColor: 'transparent', color: '#d32f2f', border: '1px solid #d32f2f', padding: '9px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>Borrar / Devolver</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {historialVentas.length === 0 && <p style={{ textAlign: 'center', marginTop: '40px', color: '#666', fontSize: '18px' }}>No hay ventas registradas hoy.</p>}
        </div>
      )}

      {/* PANTALLA: CORTE DE CAJA */}
      {pantalla === 'corte' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '8px', width: '600px', border: '1px solid #ccc', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <span style={{ fontSize: '45px' }}>📊</span> <h1 style={{ color: '#FF9800', margin: '0', fontSize: '38px', lineHeight: '1.2' }}>Corte Diario</h1>
              </div>
            </div>
            {datosCorte ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}><span style={{ fontSize: '20px', color: '#333' }}>Tickets Cobrados:</span><span style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a1a1a' }}>{datosCorte.total_ventas || 0}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}><span style={{ fontSize: '22px', color: '#333' }}>Efectivo Total en Caja:</span><span style={{ fontSize: '26px', fontWeight: 'bold', color: '#1a1a1a' }}>${formatearDinero(datosCorte.total_dinero || 0)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '35px', backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '6px', border: '1px solid #2196F3' }}><span style={{ fontSize: '24px', color: '#0d47a1', fontWeight: 'bold' }}>Ganancia Real:</span><span style={{ fontSize: '32px', fontWeight: 'bold', color: '#1a1a1a' }}>${formatearDinero(datosCorte.total_ganancia || 0)}</span></div>
                <button onClick={generarExcelCorte} style={{ width: '100%', padding: '20px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>📊 Descargar Corte en Excel (.xlsx)</button>
              </div>
            ) : ( <p style={{ textAlign: 'center', color: '#666' }}>Cargando información del corte...</p> )}
          </div>
        </div>
      )}

      {/* 🚪 MODAL CERRAR SESIÓN */}
      {modalLogout && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100000 }}>
          <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '12px', width: '380px', textAlign: 'center', boxShadow: '0 10px 35px rgba(0,0,0,0.5)' }}>
            <span style={{ fontSize: '50px', display: 'block', marginBottom: '10px' }}>🚪</span>
            <h2 style={{ color: '#1a1a1a', margin: '0 0 10px 0', fontSize: '26px' }}>¿Cerrar Sesión?</h2>
            <p style={{ color: '#555', fontSize: '16px', marginBottom: '25px' }}>Se cerrará la caja actual y regresarás a la pantalla de inicio.</p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={confirmarCerrarSesion} style={{ flex: 1, padding: '15px', backgroundColor: '#e53935', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Sí, Salir</button>
              <button onClick={() => setModalLogout(false)} style={{ flex: 1, padding: '15px', backgroundColor: '#7f8c8d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MAESTRO DE SEGURIDAD */}
      {authModal.visible && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '12px', width: '380px', textAlign: 'center', border: '2px solid #d32f2f' }}>
            <span style={{ fontSize: '50px', display: 'block', marginBottom: '10px' }}>🔒</span>
            <h2 style={{ color: '#d32f2f', margin: '0 0 10px 0', fontSize: '26px' }}>Acceso Restringido</h2>
            <p style={{ color: '#555', fontSize: '16px', marginBottom: '25px' }}>Se requiere la llave maestra para autorizar: <br/><strong>"{authModal.titulo}"</strong></p>
            <input type="password" placeholder="Contraseña requerida..." value={passInput} onChange={(e) => setPassInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verificarLlaveYEjecutar()} style={{ width: '100%', padding: '15px', fontSize: '24px', borderRadius: '8px', border: '2px solid #ccc', boxSizing: 'border-box', outline: 'none', textAlign: 'center', marginBottom: '25px', color: '#1a1a1a' }} autoFocus />
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={verificarLlaveYEjecutar} style={{ flex: 1, padding: '15px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Desbloquear</button>
              <button onClick={() => { setAuthModal({ visible: false, accion: null, parametro: null, titulo: '' }); setPassInput(''); }} style={{ flex: 1, padding: '15px', backgroundColor: '#7f8c8d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SISTEMA DE DEVOLUCIONES INTELIGENTE */}
      {modalDevolucion && ticketSeleccionado && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001 }}>
          <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '12px', width: '650px' }}>
            <h2>Opciones de Ticket y Devolución</h2>
            <p>Folio interno: {ticketSeleccionado._id} | Venta de ${formatearDinero(ticketSeleccionado.total)}</p>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
              <button onClick={() => procesarDevolucion('simple')} style={{ flex: 1, padding: '15px', backgroundColor: '#e53935', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ Borrar Simple</button>
              <button onClick={() => procesarDevolucion('completa')} style={{ flex: 1, padding: '15px', backgroundColor: '#1e88e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📦 Devolver TODO</button>
            </div>
            <hr style={{ borderTop: '1px solid #ccc', marginBottom: '20px' }} />
            <h3 style={{ color: '#2e7d32' }}>🔄 O Devolución Parcial:</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '6px', marginBottom: '20px' }}>
              <table border="0" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f0f4f8', position: 'sticky', top: 0 }}>
                  <tr><th style={{ padding: '10px' }}>Producto</th><th style={{ padding: '10px', textAlign: 'center' }}>Comprados</th><th style={{ padding: '10px', color: '#2e7d32', textAlign: 'center' }}>A Devolver</th></tr>
                </thead>
                <tbody>
                  {ticketSeleccionado.articulos.map((art, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{String(art.nombre || '')}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{float(art.cantidad)}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input type="number" step="any" min="0" max={float(art.cantidad)} value={cantidadesDevolucion[index]} onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val) && val >= 0 && val <= float(art.cantidad)) { const nuevas = [...cantidadesDevolucion]; nuevas[index] = val; setCantidadesDevolucion(nuevas); } else if (e.target.value === '' || e.target.value === '.') { const nuevas = [...cantidadesDevolucion]; nuevas[index] = e.target.value; setCantidadesDevolucion(nuevas); } }} onKeyDown={(e) => e.key === 'Enter' && procesarDevolucion('parcial')} style={{ width: '80px', padding: '6px', borderRadius: '4px', border: '2px solid #2e7d32', textAlign: 'center', fontWeight: 'bold', color: '#1a1a1a' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => procesarDevolucion('parcial')} style={{ flex: 2, padding: '15px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>✅ Confirmar Devolución Parcial</button>
              <button onClick={() => { setModalDevolucion(false); setTicketSeleccionado(null); }} style={{ flex: 1, padding: '15px', backgroundColor: '#7f8c8d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COBRO */}
      {modalCobro && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#ffffff', padding: '35px', borderRadius: '12px', width: '380px', textAlign: 'center', border: '1px solid #eee' }}>
            <h2>🧮 Calculadora de Cambio</h2>
            <p style={{ fontSize: '18px', color: '#666' }}>Total de la Venta: <strong style={{ color: '#1a1a1a', fontSize: '22px' }}>${formatearDinero(totalVenta)}</strong></p>
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Dinero Recibido ($):</label>
              <input type="text" placeholder="$0.00" value={pagoCliente} onChange={(e) => { let numString = e.target.value.replace(/\D/g, ''); if (!numString) { setPagoCliente(''); return; } let numero = parseFloat(numString) / 100; setPagoCliente(numero.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }} onKeyUp={(e) => { if (e.key === 'Enter' && pagoCliente && p_Real >= totalVenta) { cobrarVentaConfirmada(); } }} disabled={procesandoCobro} style={{ width: '100%', padding: '12px', fontSize: '20px', borderRadius: '6px', border: '2px solid #2196F3', boxSizing: 'border-box', outline: 'none', fontWeight: 'bold', color: '#1a1a1a', opacity: procesandoCobro ? 0.5 : 1 }} autoFocus />
            </div>
            {pagoCliente && p_Real >= totalVenta ? (<div style={{ backgroundColor: '#e8f5e9', padding: '15px', borderRadius: '6px', border: '1px solid #a5d6a7', marginBottom: '25px' }}><span style={{ fontSize: '16px', color: '#2e7d32', display: 'block' }}>Cambio a regresar:</span><strong style={{ fontSize: '32px', color: '#1a1a1a' }}>${formatearDinero(p_Real - totalVenta)} MXN</strong></div>) : pagoCliente && p_Real < totalVenta ? (<div style={{ backgroundColor: '#ffebee', padding: '12px', borderRadius: '6px', border: '1px solid #ef9a9a', marginBottom: '25px', color: '#c62828', fontWeight: 'bold' }}>⚠️ Cantidad insuficiente</div>) : (<div style={{ height: '70px', marginBottom: '25px' }}></div>)}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={cobrarVentaConfirmada} disabled={!pagoCliente || p_Real < totalVenta || procesandoCobro} style={{ flex: 1, padding: '14px', backgroundColor: (!pagoCliente || p_Real < totalVenta || procesandoCobro) ? '#bdc3c7' : '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: (!pagoCliente || p_Real < totalVenta || procesandoCobro) ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                {procesandoCobro ? '⏳ Procesando...' : '✔ Confirmar Venta'}
              </button>
              <button onClick={() => { setModalCobro(false); setPagoCliente(''); }} disabled={procesandoCobro} style={{ flex: 1, padding: '14px', backgroundColor: '#7f8c8d', color: 'white', border: 'none', borderRadius: '6px', cursor: procesandoCobro ? 'not-allowed' : 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App