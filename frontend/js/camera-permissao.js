/**
 * CameraPermissao — fluxo de consentimento para uso da câmera.
 *
 * Nada é pedido ao abrir a página. Só quando a pessoa clica em "Escanear":
 *   1. Câmera já liberada  -> abre o scanner direto.
 *   2. Câmera bloqueada    -> aviso ensinando a liberar nas configurações.
 *   3. Ainda não decidido  -> modal próprio (termos + Aceitar / Recusar).
 *        Aceitar -> permissão nativa do navegador -> abre o scanner.
 *        Recusar -> aviso de que o serviço não funciona sem câmera,
 *                   com "Tentar novamente" (reabre o modal).
 *
 * Uso: CameraPermissao.solicitar(function () { ...abre o scanner... });
 */
var CameraPermissao = (function () {
    var modalCamera = document.getElementById('modal-camera');
    var modalRecusado = document.getElementById('modal-recusado');
    var checkTermos = document.getElementById('check-termos');
    var btnAceitar = document.getElementById('btn-aceitar-camera');
    var btnRecusar = document.getElementById('btn-recusar-camera');
    var btnTentar = document.getElementById('btn-tentar-novamente');
    var btnFechar = document.getElementById('btn-fechar-recusado');
    var msgRecusado = document.getElementById('modal-recusado-msg');
    var ajudaRecusado = document.getElementById('modal-recusado-ajuda');

    var aoLiberar = null;

    var MSG_RECUSADO = 'Sem acesso à câmera você não conseguirá usar o escaneamento de QR code. ' +
        'Se recusou sem querer, é só tentar novamente.';

    function abrir(modal) { modal.hidden = false; }
    function fechar(modal) { modal.hidden = true; }

    function mostrarAvisoRecusado(mensagem, ajuda, permitirTentar) {
        msgRecusado.textContent = mensagem || MSG_RECUSADO;
        ajudaRecusado.textContent = ajuda || '';
        ajudaRecusado.hidden = !ajuda;
        btnTentar.style.display = permitirTentar === false ? 'none' : '';
        abrir(modalRecusado);
    }

    function mostrarConsentimento() {
        checkTermos.checked = false;
        btnAceitar.disabled = true;
        abrir(modalCamera);
    }

    // 'granted' | 'denied' | 'prompt' | 'unknown' (Safari/iOS não suporta query)
    function estadoPermissao() {
        if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve('unknown');
        return navigator.permissions.query({ name: 'camera' })
            .then(function (r) { return r.state; })
            .catch(function () { return 'unknown'; });
    }

    function mostrarBloqueado() {
        mostrarAvisoRecusado(
            'O acesso à câmera está bloqueado neste navegador, então o leitor de QR code não pode ser usado.',
            'Para liberar: toque no cadeado (ou ícone de configurações) ao lado do endereço do site, ' +
            'escolha "Permissões" > "Câmera" > "Permitir" e depois clique em "Tentar novamente".'
        );
    }

    function iniciarFluxo() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            mostrarAvisoRecusado(
                'Este navegador ou endereço não permite o uso da câmera.',
                'O acesso à câmera só funciona em conexão segura (https) ou em localhost. ' +
                'Abra o sistema por um endereço https ou use outro navegador.',
                false
            );
            return;
        }
        estadoPermissao().then(function (estado) {
            if (estado === 'granted') { liberar(); }
            else if (estado === 'denied') { mostrarBloqueado(); }
            else { mostrarConsentimento(); }
        });
    }

    function liberar() {
        fechar(modalCamera);
        fechar(modalRecusado);
        if (aoLiberar) aoLiberar();
    }

    // Aqui (e só aqui) o navegador mostra a permissão nativa.
    function pedirPermissaoNativa() {
        fechar(modalCamera);
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
            .then(function (stream) {
                // Só queríamos a permissão: solta a câmera para o scanner usar.
                stream.getTracks().forEach(function (t) { t.stop(); });
                liberar();
            })
            .catch(function (erro) {
                var nome = erro && erro.name;
                if (nome === 'NotAllowedError' || nome === 'SecurityError' || nome === 'PermissionDeniedError') {
                    estadoPermissao().then(function (estado) {
                        if (estado === 'denied') { mostrarBloqueado(); }
                        else { mostrarAvisoRecusado(); }
                    });
                } else if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
                    mostrarAvisoRecusado('Nenhuma câmera foi encontrada neste dispositivo.', '', false);
                } else if (nome === 'NotReadableError') {
                    mostrarAvisoRecusado('A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.');
                } else {
                    mostrarAvisoRecusado('Não foi possível acessar a câmera. Tente novamente.');
                }
            });
    }

    // ---- Eventos dos modais ----
    checkTermos.addEventListener('change', function () { btnAceitar.disabled = !checkTermos.checked; });
    btnAceitar.addEventListener('click', function () { if (checkTermos.checked) pedirPermissaoNativa(); });
    btnRecusar.addEventListener('click', function () { fechar(modalCamera); mostrarAvisoRecusado(); });
    btnFechar.addEventListener('click', function () { fechar(modalRecusado); });
    btnTentar.addEventListener('click', function () { fechar(modalRecusado); iniciarFluxo(); });

    // Clicar fora da caixa ou apertar Esc fecha o modal (equivale a recusar no de consentimento)
    modalCamera.addEventListener('click', function (e) { if (e.target === modalCamera) btnRecusar.click(); });
    modalRecusado.addEventListener('click', function (e) { if (e.target === modalRecusado) fechar(modalRecusado); });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (!modalCamera.hidden) btnRecusar.click();
        else if (!modalRecusado.hidden) fechar(modalRecusado);
    });

    return {
        solicitar: function (callback) { aoLiberar = callback; iniciarFluxo(); }
    };
})();
