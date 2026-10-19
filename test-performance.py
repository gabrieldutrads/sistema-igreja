#!/usr/bin/env python3
"""
Script de Teste de Performance do Site
Testa velocidade de carregamento das principais páginas
"""

import time
import statistics
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
import json

# CONFIGURAÇÃO - Altere para a URL do seu site
BASE_URL = "https://SEU-DOMINIO.vercel.app"

# Páginas para testar
PAGES = [
    "/",
    "/pages/cadastro.html",
    "/pages/admin.html",
    "/pages/membro-login.html",
    "/pages/membro.html",
    "/pages/relatorios.html",
    "/pages/indicadores.html",
    "/pages/configuracoes.html",
    "/pages/privacidade.html",
    "/pages/suporte.html",
]

# Número de requisições por página
NUM_REQUESTS = 5

def test_page(url, timeout=10):
    """Testa o tempo de resposta de uma página"""
    try:
        req = Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Performance Test)',
                'Accept': 'text/html,application/xhtml+xml'
            }
        )
        
        start = time.time()
        with urlopen(req, timeout=timeout) as response:
            _ = response.read()
            status = response.status
        end = time.time()
        
        return {
            'success': True,
            'status': status,
            'time': (end - start) * 1000,  # em milissegundos
            'error': None
        }
    except HTTPError as e:
        return {
            'success': False,
            'status': e.code,
            'time': None,
            'error': f'HTTP {e.code}'
        }
    except URLError as e:
        return {
            'success': False,
            'status': None,
            'time': None,
            'error': str(e.reason)
        }
    except Exception as e:
        return {
            'success': False,
            'status': None,
            'time': None,
            'error': str(e)
        }

def run_performance_test():
    """Executa o teste completo de performance"""
    print("="*70)
    print("🚀 TESTE DE PERFORMANCE DO SITE")
    print("="*70)
    print(f"📍 URL Base: {BASE_URL}")
    print(f"🔢 Requisições por página: {NUM_REQUESTS}")
    print("="*70)
    print()
    
    all_results = {}
    total_times = []
    
    for page in PAGES:
        url = BASE_URL + page
        print(f"📄 Testando: {page}")
        
        times = []
        errors = 0
        
        for i in range(NUM_REQUESTS):
            result = test_page(url)
            
            if result['success']:
                times.append(result['time'])
                print(f"   Req {i+1}: ✅ {result['time']:.0f}ms (HTTP {result['status']})")
            else:
                errors += 1
                print(f"   Req {i+1}: ❌ {result['error']}")
            
            # Pequeno delay entre requisições
            time.sleep(0.5)
        
        if times:
            avg_time = statistics.mean(times)
            min_time = min(times)
            max_time = max(times)
            
            all_results[page] = {
                'avg': avg_time,
                'min': min_time,
                'max': max_time,
                'errors': errors,
                'times': times
            }
            total_times.extend(times)
            
            print(f"   📊 Média: {avg_time:.0f}ms | Min: {min_time:.0f}ms | Max: {max_time:.0f}ms")
        else:
            all_results[page] = {
                'avg': None,
                'errors': errors,
                'times': []
            }
            print(f"   ❌ Todas as requisições falharam")
        
        print()
    
    # Resumo geral
    print("="*70)
    print("📊 RESUMO GERAL")
    print("="*70)
    
    if total_times:
        overall_avg = statistics.mean(total_times)
        overall_min = min(total_times)
        overall_max = max(total_times)
        
        print(f"⏱️  Tempo Médio Geral: {overall_avg:.0f}ms")
        print(f"🚀 Tempo Mais Rápido: {overall_min:.0f}ms")
        print(f"🐌 Tempo Mais Lento: {overall_max:.0f}ms")
        print()
        
        # Classificação de performance
        if overall_avg < 200:
            rating = "🟢 EXCELENTE"
            comment = "Site muito rápido!"
        elif overall_avg < 500:
            rating = "🟡 BOM"
            comment = "Performance adequada"
        elif overall_avg < 1000:
            rating = "🟠 REGULAR"
            comment = "Pode melhorar"
        else:
            rating = "🔴 LENTO"
            comment = "Precisa otimização"
        
        print(f"📈 Avaliação: {rating}")
        print(f"💬 {comment}")
        print()
        
        # Páginas mais rápidas e mais lentas
        sorted_pages = sorted(
            [(page, data['avg']) for page, data in all_results.items() if data['avg'] is not None],
            key=lambda x: x[1]
        )
        
        if sorted_pages:
            print("🏆 TOP 3 PÁGINAS MAIS RÁPIDAS:")
            for i, (page, avg_time) in enumerate(sorted_pages[:3], 1):
                print(f"   {i}. {page} - {avg_time:.0f}ms")
            print()
            
            if len(sorted_pages) > 3:
                print("🐌 TOP 3 PÁGINAS MAIS LENTAS:")
                for i, (page, avg_time) in enumerate(sorted_pages[-3:][::-1], 1):
                    print(f"   {i}. {page} - {avg_time:.0f}ms")
                print()
    else:
        print("❌ Nenhuma requisição bem-sucedida")
    
    # Erros
    total_errors = sum(data['errors'] for data in all_results.values())
    if total_errors > 0:
        print(f"⚠️  Total de Erros: {total_errors}")
        print()
    
    print("="*70)
    print("✅ Teste concluído!")
    print("="*70)
    
    # Salvar resultados em JSON
    output = {
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'base_url': BASE_URL,
        'num_requests_per_page': NUM_REQUESTS,
        'results': all_results,
        'summary': {
            'overall_avg': statistics.mean(total_times) if total_times else None,
            'overall_min': min(total_times) if total_times else None,
            'overall_max': max(total_times) if total_times else None,
            'total_errors': total_errors
        }
    }
    
    filename = f"performance-test-{time.strftime('%Y%m%d-%H%M%S')}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"📄 Resultados salvos em: {filename}")

if __name__ == "__main__":
    try:
        run_performance_test()
    except KeyboardInterrupt:
        print("\n\n⚠️  Teste interrompido pelo usuário")
    except Exception as e:
        print(f"\n\n❌ Erro no teste: {e}")
