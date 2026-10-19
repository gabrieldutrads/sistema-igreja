# Script de Teste de Performance do Site
# PowerShell Version para Windows

# CONFIGURAÇÃO - Altere para a URL do seu site
$BASE_URL = "https://SEU-DOMINIO.vercel.app"

# Páginas para testar
$PAGES = @(
    "/",
    "/pages/cadastro.html",
    "/pages/admin.html",
    "/pages/membro-login.html",
    "/pages/membro.html",
    "/pages/relatorios.html",
    "/pages/indicadores.html",
    "/pages/configuracoes.html",
    "/pages/privacidade.html",
    "/pages/suporte.html"
)

# Número de requisições por página
$NUM_REQUESTS = 5

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "🚀 TESTE DE PERFORMANCE DO SITE" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "📍 URL Base: $BASE_URL" -ForegroundColor Yellow
Write-Host "🔢 Requisições por página: $NUM_REQUESTS" -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

$allTimes = @()
$results = @{}

foreach ($page in $PAGES) {
    $url = $BASE_URL + $page
    Write-Host "📄 Testando: $page" -ForegroundColor Cyan
    
    $times = @()
    $errors = 0
    
    for ($i = 1; $i -le $NUM_REQUESTS; $i++) {
        try {
            $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
            $stopwatch.Stop()
            
            $timeMs = $stopwatch.ElapsedMilliseconds
            $times += $timeMs
            
            Write-Host "   Req $i`: " -NoNewline
            Write-Host "✅ " -ForegroundColor Green -NoNewline
            Write-Host "$($timeMs)ms (HTTP $($response.StatusCode))"
        }
        catch {
            $errors++
            Write-Host "   Req $i`: " -NoNewline
            Write-Host "❌ " -ForegroundColor Red -NoNewline
            Write-Host $_.Exception.Message
        }
        
        Start-Sleep -Milliseconds 500
    }
    
    if ($times.Count -gt 0) {
        $avg = ($times | Measure-Object -Average).Average
        $min = ($times | Measure-Object -Minimum).Minimum
        $max = ($times | Measure-Object -Maximum).Maximum
        
        $results[$page] = @{
            avg = $avg
            min = $min
            max = $max
            errors = $errors
        }
        
        $allTimes += $times
        
        Write-Host "   📊 Média: $([math]::Round($avg, 0))ms | Min: $($min)ms | Max: $($max)ms" -ForegroundColor Yellow
    }
    else {
        $results[$page] = @{
            avg = $null
            errors = $errors
        }
        Write-Host "   ❌ Todas as requisições falharam" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Resumo geral
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "📊 RESUMO GERAL" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan

if ($allTimes.Count -gt 0) {
    $overallAvg = ($allTimes | Measure-Object -Average).Average
    $overallMin = ($allTimes | Measure-Object -Minimum).Minimum
    $overallMax = ($allTimes | Measure-Object -Maximum).Maximum
    
    Write-Host "⏱️  Tempo Médio Geral: $([math]::Round($overallAvg, 0))ms" -ForegroundColor Yellow
    Write-Host "🚀 Tempo Mais Rápido: $($overallMin)ms" -ForegroundColor Green
    Write-Host "🐌 Tempo Mais Lento: $($overallMax)ms" -ForegroundColor Red
    Write-Host ""
    
    # Classificação
    $rating = ""
    $comment = ""
    
    if ($overallAvg -lt 200) {
        $rating = "🟢 EXCELENTE"
        $comment = "Site muito rápido!"
        $color = "Green"
    }
    elseif ($overallAvg -lt 500) {
        $rating = "🟡 BOM"
        $comment = "Performance adequada"
        $color = "Yellow"
    }
    elseif ($overallAvg -lt 1000) {
        $rating = "🟠 REGULAR"
        $comment = "Pode melhorar"
        $color = "DarkYellow"
    }
    else {
        $rating = "🔴 LENTO"
        $comment = "Precisa otimização"
        $color = "Red"
    }
    
    Write-Host "📈 Avaliação: $rating" -ForegroundColor $color
    Write-Host "💬 $comment" -ForegroundColor $color
    Write-Host ""
    
    # Páginas mais rápidas
    $sorted = $results.GetEnumerator() | Where-Object { $_.Value.avg -ne $null } | Sort-Object { $_.Value.avg }
    
    if ($sorted.Count -gt 0) {
        Write-Host "🏆 TOP 3 PÁGINAS MAIS RÁPIDAS:" -ForegroundColor Green
        $top3 = $sorted | Select-Object -First 3
        $i = 1
        foreach ($item in $top3) {
            Write-Host "   $i. $($item.Key) - $([math]::Round($item.Value.avg, 0))ms"
            $i++
        }
        Write-Host ""
        
        if ($sorted.Count -gt 3) {
            Write-Host "🐌 TOP 3 PÁGINAS MAIS LENTAS:" -ForegroundColor Red
            $bottom3 = $sorted | Select-Object -Last 3 | Sort-Object { $_.Value.avg } -Descending
            $i = 1
            foreach ($item in $bottom3) {
                Write-Host "   $i. $($item.Key) - $([math]::Round($item.Value.avg, 0))ms"
                $i++
            }
            Write-Host ""
        }
    }
}
else {
    Write-Host "❌ Nenhuma requisição bem-sucedida" -ForegroundColor Red
}

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "✅ Teste concluído!" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
